import xlsx from 'xlsx';
import fs from 'fs';

const filePath = 'd:\\int\\int-hr-app2\\MR.Hafez\\Department Structureb and level.xlsx';
const workbook = xlsx.readFile(filePath);

const result = {};
workbook.SheetNames.forEach(sheetName => {
  result[sheetName] = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
});

console.log(JSON.stringify(result, null, 2));
