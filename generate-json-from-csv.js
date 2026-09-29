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
// LC116 items missing from the IBPT table (added by LC 157/2016) are generated
// from the rates of the NBS code set in lc116-nbs-map.json, so they follow every
// new IBPT version. Items mapped to null are kept as they are.
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

// lc116 code => nbs code, see lc116-nbs-map.json
var lc116NbsMap = JSON.parse(fs.readFileSync(path.join(__dirname, "lc116-nbs-map.json"), "utf8"));
delete lc116NbsMap._comment;

var mappedNbsCodes = Object.keys(lc116NbsMap).map(function (code) {
  return lc116NbsMap[code].nbs;
}).filter(Boolean);

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

// writes the lc116 items missing from the csv using the rates of the mapped nbs code
var writeMappedLc116 = function (state, lc116Codes, nbsRows) {
  var count = 0;

  Object.keys(lc116NbsMap).forEach(function (code) {
    var nbs = lc116NbsMap[code].nbs;

    // null means no known nbs correlation, or the code is already in the ibpt table
    if (!nbs || lc116Codes[code]) return;

    if (!nbsRows[nbs]) {
      throw new Error("nbs code " + nbs + " mapped to lc116 " + code + " not found for state " + state);
    }

    var data = toEnglish(state, nbsRows[nbs]);
    data.fiscalType = "lc116";
    data.code = code;
    data.mappedFrom = "nbs/" + nbs;
    writeFile(data);
    count++;
  });

  return count;
};

// processes a single state csv, resolving with the number of files per table
var processState = function (state) {
  return new Promise(function (resolve, reject) {
    var fileName = csvFileName(state);
    var counts = {};
    var lc116Codes = {};
    var nbsRows = {};
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
        var mapped = table === "nbs" && mappedNbsCodes.indexOf(data.codigo) !== -1;

        // we only need to process the selected types (also skips the header row)
        if (!table || (tables.indexOf(table) === -1 && !mapped))
          return;

        if (data.versao !== version) {
          return fail(new Error("found version '" + data.versao + "' on code " +
            data.codigo + ", expected '" + version + "'"));
        }

        if (mapped) nbsRows[data.codigo] = data;
        if (table === "lc116") lc116Codes[data.codigo] = true;
        if (tables.indexOf(table) === -1) return;

        try {
          writeFile(toEnglish(state, data));
          counts[table]++;
        } catch (e) {
          fail(e);
        }
      })
      .on("end", function () {
        if (failed) return;

        if (tables.indexOf("lc116") !== -1) {
          try {
            counts.lc116 += writeMappedLc116(state, lc116Codes, nbsRows);
          } catch (e) {
            return fail(e);
          }
        }

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
          var code = path.basename(file, ".json");
          // keeps the lc116 items without nbs correlation, they are not in the ibpt table
          var manual = table === "lc116" && lc116NbsMap[code] && !lc116NbsMap[code].nbs;
          if (path.extname(file) === ".json" && !manual) fs.unlinkSync(path.join(dir, file));
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
