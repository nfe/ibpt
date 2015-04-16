var csv = require("fast-csv"),
    fs = require("fs"),
    iconvlite = require('iconv-lite'),
    path = require("path"),
    util = require("util");

var states = ["ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg",
              "ms", "mt", "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr",
              "rs", "sc", "se", "sp", "to"];

var toISOString = function(date) {
  var a = date.split('/');
  return a[2] + "-" + a[1] + "-" + a[0];
};

var toEnglish = function(state, data) {
  return {
    fiscalType: (data.tipo == 1) ? 'nbs' : 'ncm',
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

var writeFile = function(data) {
  var path = util.format('%s/%s/%s.json', data.fiscalType, data.state, data.code);
  fs.writeFileSync(path, iconvlite.encode(JSON.stringify(data), 'UTF-8'));
};

states.forEach(function(state) {

  // create folders to json files
  fs.mkdir("ncm/" + state.toLowerCase(), function(e) {});
  fs.mkdir("nbs/" + state.toLowerCase(), function(e) {});

  var fileName = "raw-data/TabelaIBPTax" + state.toUpperCase() + "15.1.C.csv";

  fs.readFile(fileName, function(err, data) {

    if (err) {
      console.error("ERROR: Reading file ", fileName, err);
      throw err;
    }

    console.log("Processing file " + fileName);

    csv
      .fromString(iconvlite.decode(data, 'ISO-8859-1'), {
        headers: ["codigo", "ex", "tipo", "descricao", "nacionalfederal",
                  "importadosfederal", "estadual", "municipal",
                  "vigenciainicio", "vigenciafim", "chave", "versao", "fonte"],
        quoteColumns: false,
        ignoreEmpty: true,
        quote: null,
        delimiter: ';'
      })
      .on("error", function(err) {
        console.error("ERROR: Parsing file " + fileName, err);
      })
      .on("data", function(data) {
        // we only need to process the types
        if (data.tipo != 1 && data.tipo != 0)
          return;

        writeFile(toEnglish(state, data));
      })
      .on("end", function() {
        console.log("Processed file " + fileName);
      });

  }); // end of csv

}); // end of state
