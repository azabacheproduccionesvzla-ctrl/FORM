import XLSX from "xlsx";
import path from "path";

const filePath = path.resolve("Cuadro Maestro.xlsx");
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Total rows in file:", data.length);

console.log("\nChecking rows 80 to 120:");
for (let i = 80; i <= 120 && i < data.length; i++) {
  const row = data[i];
  if (row && row.some(cell => cell !== null && cell !== undefined && cell !== "")) {
    console.log(`Row ${i} is NOT empty:`, row);
  } else {
    // Just count empty rows or log them briefly
  }
}

// Let's find out how many empty rows are between row 80 and row 1070
let emptyCount = 0;
for (let i = 80; i < 1078 && i < data.length; i++) {
  const row = data[i];
  const isEmpty = !row || row.every(cell => cell === null || cell === undefined || cell === "");
  if (isEmpty) {
    emptyCount++;
  } else {
    console.log(`Found a non-empty row in between at ${i}:`, row);
  }
}
console.log(`\nTotal empty rows between 80 and 1077: ${emptyCount}`);
