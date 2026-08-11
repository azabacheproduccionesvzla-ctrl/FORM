import XLSX from "xlsx";
import path from "path";

const filePath = path.resolve("Cuadro Maestro.xlsx");
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Header columns:");
data[0].forEach((h, i) => console.log(`${i}: ${h}`));

console.log("\nShowing rows 1050 to 1070:");
for (let i = 1050; i < 1070 && i < data.length; i++) {
  console.log(`\nRow ${i}:`);
  console.log(data[i]);
}
