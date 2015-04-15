
var csv = require("fast-csv"),
    fs = require("fs"),
    iconvlite = require('iconv-lite'),
    path = require("path")
    util = require("util");

var states = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

var convertDateToISOString = function(date) {
  var a = date.split('/');
  return a[2] + "-" + a[1] + "-" + a[0];
};

states.forEach(function(state) {

  fs.mkdir("ncm/" + state.toLowerCase(), function(e) {});
  fs.mkdir("nbs/" + state.toLowerCase(), function(e) {});

  var fileName = "tabelas/TabelaIBPTax" + state + "15.1.C.csv";

  var content = fs.readFile(fileName, function (err, data) {

    if (err)
    {
      console.log("Reading file ", fileName, err);
      throw err;
    }

    console.log("Processing file " + fileName);

    var string = iconvlite.decode(data, 'ISO-8859-1');

    csv
     .fromString(string, {
       headers : ["codigo",
                  "ex",
                  "tipo",
                  "descricao",
                  "nacionalfederal",
                  "importadosfederal",
                  "estadual",
                  "municipal",
                  "vigenciainicio",
                  "vigenciafim",
                  "chave",
                  "versao",
                  "fonte"],
       quoteColumns: false, ignoreEmpty:true, quote:null, delimiter:';'
     })
     .on("error", function(err) {
       console.log(fileName, err);
       throw err;
     })
     .on("data", function(data) {
       // convert date to iso 8601
       data.vigenciainicio = convertDateToISOString(data.vigenciainicio);
       data.vigenciafim = convertDateToISOString(data.vigenciafim);

       var type = (data.tipo == 1)
                  ? 'nbs'
                  : 'ncm';
       var filePath = util.format('%s/%s/%s.json', type, state.toLowerCase(), data.codigo);
       var data = iconvlite.encode(JSON.stringify(data), 'UTF-8')

       fs.writeFileSync(filePath, data);
     })
     .on("end", function(){
         console.log("Processed file " + fileName);
     });

  }); // end of csv

}); // end of state
