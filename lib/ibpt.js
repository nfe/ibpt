// shared constants and helpers for the IBPT scripts

// all brazilian states, one IBPT csv file per state
var states = ["ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg",
  "ms", "mt", "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr",
  "rs", "sc", "se", "sp", "to"
];

// fiscal tables generated from the csv (key is the "tipo" column)
var tables = {
  "0": "ncm",
  "1": "nbs",
  "2": "lc116"
};

var allTables = ["ncm", "nbs", "lc116"];

// IBPT versions look like 19.2.B / 26.2.B
var isValidVersion = function (version) {
  return /^\d{2}\.\d\.[A-Z]$/.test(version || "");
};

// parses "--name value" / "--name=value" / "--flag" style arguments
var parseArgs = function (argv) {
  var args = { _: [] };
  for (var i = 0; i < argv.length; i++) {
    var arg = argv[i];
    if (arg.indexOf("--") !== 0) {
      args._.push(arg);
      continue;
    }
    var eq = arg.indexOf("=");
    if (eq !== -1) {
      args[arg.substring(2, eq)] = arg.substring(eq + 1);
    } else if (i + 1 < argv.length && argv[i + 1].indexOf("--") !== 0) {
      args[arg.substring(2)] = argv[++i];
    } else {
      args[arg.substring(2)] = true;
    }
  }
  return args;
};

// parses a comma separated list of tables, validating each one
var parseTables = function (value, defaults) {
  if (!value || value === true) return defaults;
  var list = String(value).toLowerCase().split(",").map(function (t) {
    return t.trim();
  }).filter(Boolean);
  list.forEach(function (t) {
    if (allTables.indexOf(t) === -1) {
      throw new Error("Unknown table '" + t + "', expected one of: " + allTables.join(", "));
    }
  });
  return list;
};

module.exports = {
  states: states,
  tables: tables,
  allTables: allTables,
  isValidVersion: isValidVersion,
  parseArgs: parseArgs,
  parseTables: parseTables
};
