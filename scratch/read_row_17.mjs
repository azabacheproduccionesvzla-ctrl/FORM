import XLSX from "xlsx";
import path from "path";

const filePath = path.resolve("Cuadro Maestro.xlsx");
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Row 17 in Cuadro Maestro.xlsx:");
console.log(data[17]);
