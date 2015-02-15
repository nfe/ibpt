
var csv = require("fast-csv"),
    fs = require("fs"),
    iconvlite = require('iconv-lite'),
    path = require("path");

var estados = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

estados.forEach(function(estado) {

  fs.mkdir("ncm/"+estado.toLowerCase(), function(e) {});
  fs.mkdir("nbs/"+estado.toLowerCase(), function(e) {});

  var content = fs.readFileSync("tabelas/TabelaIBPTax"+estado+"15.1.B.csv");
  var string = iconvlite.decode(content, 'ISO-8859-1');

  csv
   .fromString(string, {
     headers : ["codigo","ex","tipo","descricao","nacionalfederal","importadosfederal","estadual","municipal","vigenciainicio","vigenciafim","chave","versao","fonte"],
     quoteColumns: false, ignoreEmpty:true, quote:null, delimiter:';'
   })
   .on("data", function(data){
     var tipo = 'ncm';
     if (data.tipo == 1) {
       tipo = 'nbs';
     }
     fs.writeFile(tipo+"/"+estado.toLowerCase()+"/" + data.codigo + ".json", JSON.stringify(data), function(err) {
      if(err) {
        console.log(err);
      } else {
        console.log("Criado arquivo " + data.codigo);
      }
     });
   })
   .on("end", function(){
       console.log("done");
   });

});
