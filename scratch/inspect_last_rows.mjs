import XLSX from "xlsx";
import path from "path";

const filePath = path.resolve("Cuadro Maestro.xlsx");
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Finding last 10 non-empty rows...");
let found = 0;
for (let i = data.length - 1; i > 0; i--) {
  const row = data[i];
  if (row && row.some(cell => cell !== null && cell !== undefined && cell !== "")) {
    console.log(`\nRow ${i}:`);
    console.log(row);
    found++;
    if (found >= 10) break;
  }
}
