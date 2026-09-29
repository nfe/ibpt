// Generates the {table}/{state}/{code}.json files from the IBPT csv files.
//
// usage: node generate-json-from-csv.js <version> [--tables lc116,nbs] [--clean]
//
//   <version>  IBPT table version, ex: 26.2.B (or IBPT_VERSION env variable).
//              Expects raw-data/TabelaIBPTax{UF}{version}.csv for all 27 states.
//   --tables   tables to generate (default: ncm,nbs,lc116)
//   --clean    removes the existing json files of the selected tables before
//              generating, so codes dropped by IBPT do not stay behind
//
// Exits with non-zero code when a csv is missing, can not be parsed or has
// rows from a different version, so a partial table is never generated silently.

var csv = require("fast-csv"),
  fs = require("fs"),
  iconvlite = require('iconv-lite'),
  path = require("path"),
  util = require("util"),
  ibpt = require("./lib/ibpt");

var args = ibpt.parseArgs(process.argv.slice(2));

// constant of version
var version = args._[0] || process.env.IBPT_VERSION;

if (!ibpt.isValidVersion(version)) {
  console.error("ERROR: invalid or missing IBPT version '" + (version || "") + "' (expected ex: 26.2.B)");
  console.error("usage: node generate-json-from-csv.js <version> [--tables lc116,nbs] [--clean]");
  process.exit(1);
}

var tables;
try {
  tables = ibpt.parseTables(args.tables, ibpt.allTables);
} catch (e) {
  console.error("ERROR: " + e.message);
  process.exit(1);
}

var states = ibpt.states;

var csvFileName = function (state) {
  return path.join("raw-data", "TabelaIBPTax" + state.toUpperCase() + version + ".csv");
};

// converts date to ISO date format
var toISOString = function (date) {
  var a = date.split('/');
  return a[2] + "-" + a[1] + "-" + a[0];
};

// converts the data from csv from
// portuguese fields to english fields
var toEnglish = function (state, data) {
  return {
    fiscalType: ibpt.tables[data.tipo.toString()],
    state: state,
    source: data.fonte,
    version: data.versao,
    code: data.codigo,
    effectiveDate: toISOString(data.vigenciainicio),
    federalNationalRate: parseFloat(data.nacionalfederal),
    federalImportedRate: parseFloat(data.importadosfederal),
    stateRate: parseFloat(data.estadual),
    municipalRate: parseFloat(data.municipal)
  };
};

// writes the json file based on the data
var writeFile = function (data) {
  var path = util.format('%s/%s/%s.json', data.fiscalType, data.state, data.code);
  fs.writeFileSync(path, iconvlite.encode(JSON.stringify(data), 'UTF-8'));
};

// processes a single state csv, resolving with the number of files per table
var processState = function (state) {
  return new Promise(function (resolve, reject) {
    var fileName = csvFileName(state);
    var counts = {};
    var failed = false;
    var fail = function (err) {
      if (failed) return;
      failed = true;
      reject(new Error("Parsing file " + fileName + ": " + err.message));
    };

    tables.forEach(function (table) {
      counts[table] = 0;
    });

    console.log("Processing file " + fileName);

    var readStream = fs.createReadStream(fileName)
      .on("error", fail)
      .pipe(iconvlite.decodeStream('ISO-8859-1'));

    csv.parseStream(readStream, {
        headers: ["codigo", "ex", "tipo", "descricao",
          "nacionalfederal", "importadosfederal",
          "estadual", "municipal", "vigenciainicio",
          "vigenciafim", "chave", "versao", "fonte"
        ],
        ignoreEmpty: true,
        quote: null,
        delimiter: ';'
      })
      .on("error", fail)
      .on("data", function (data) {
        if (failed) return;

        var table = ibpt.tables[data.tipo];

        // we only need to process the selected types (also skips the header row)
        if (!table || tables.indexOf(table) === -1)
          return;

        if (data.versao !== version) {
          return fail(new Error("found version '" + data.versao + "' on code " +
            data.codigo + ", expected '" + version + "'"));
        }

        try {
          writeFile(toEnglish(state, data));
          counts[table]++;
        } catch (e) {
          fail(e);
        }
      })
      .on("end", function () {
        if (failed) return;
        console.log("Processed file " + fileName + " " + JSON.stringify(counts));
        resolve(counts);
      });
  });
};

var main = async function () {
  // validates all csv files before touching the json files
  var missing = states.map(csvFileName).filter(function (fileName) {
    return !fs.existsSync(fileName);
  });

  if (missing.length) {
    throw new Error("missing csv files for version " + version + ":\n  " + missing.join("\n  "));
  }

  states.forEach(function (state) {
    tables.forEach(function (table) {
      var dir = path.join(table, state);

      if (args.clean && fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(function (file) {
          if (path.extname(file) === ".json") fs.unlinkSync(path.join(dir, file));
        });
      }

      // create folders to json files
      fs.mkdirSync(dir, { recursive: true });
    });
  });

  var totals = {};
  var empty = [];

  for (var i = 0; i < states.length; i++) {
    var counts = await processState(states[i]);

    tables.forEach(function (table) {
      totals[table] = (totals[table] || 0) + counts[table];
      if (counts[table] === 0) empty.push(table + "/" + states[i]);
    });
  }

  if (empty.length) {
    throw new Error("no codes generated for: " + empty.join(", "));
  }

  console.log("Generated version " + version + " " + JSON.stringify(totals));
};

main().catch(function (err) {
  console.error("ERROR: " + err.message);
  process.exit(1);
});
