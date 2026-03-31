const express = require("express");
const multer = require("multer");
const pdf = require("pdf-parse");
const Tesseract = require("tesseract.js");
const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 3000;

// Configure Multer for file uploads
const upload = multer({
  dest: "uploads/", // temporary storage for uploaded files
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Middleware to enable CORS for all routes
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // Allow all origins for development
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.use(express.json()); // For parsing application/json

// Helper function to delete file after processing
const deleteFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) console.error("Error deleting file:", err);
    console.log("File deleted:", filePath);
  });
};

// API to handle file upload and text extraction
app.post("/upload", upload.single("invoice"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const filePath = req.file.path;
  const fileExtension = path.extname(req.file.originalname).toLowerCase();
  let extractedText = "";

  try {
    if (fileExtension === ".pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      extractedText = data.text;
    } else if ([`.png`, `.jpg`, `.jpeg`].includes(fileExtension)) {
      const { data: ocrResult } = await Tesseract.recognize(
        filePath,
        "eng", // English language
        { 
            logger: m => console.log(m) 
        } // Log progress
      );
      extractedText = ocrResult.text;
    } else {
      return res.status(400).json({ error: "Unsupported file type." });
    }

    // Basic data extraction (to be enhanced)
    const invoiceNumber = extractedText.match(/(invoice|bill|receipt)\s*#?\s*([a-zA-Z0-9-]+)/i)?.[2] || "";
    const date = extractedText.match(/(date|bill date)\s*:?\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i)?.[2] || "";
    const customerName = extractedText.match(/(customer|client|bill to|to):?\s*([a-zA-Z\s.]+)/i)?.[2] || "";
    const totalAmount = extractedText.match(/(total|grand total|amount due)\s*:?\s*(\S*\d+\.\d{2})/i)?.[2] || "";

    // Extract line items (very basic - needs robust implementation)
    const productLines = extractedText.split(/\n/).filter(line => 
      /\d+\s+[a-zA-Z0-9\s]+\s+\d+(\.\d{2})?\s+\d+(\.\d{2})?/i.test(line) // Example: "1 Product Name 10.00 100.00"
    ).map(line => {
      const parts = line.split(/\s+/);
      // This is a very simplistic parsing and will need to be improved
      return {
        product: parts.slice(1, -2).join(" "),
        qty: parseFloat(parts[parts.length - 2]),
        price: parseFloat(parts[parts.length - 3]), // Assuming price is before total
        total: parseFloat(parts[parts.length - 1]),
      };
    });

    res.json({
      extractedText,
      invoiceData: {
        invoiceNumber,
        date,
        customerName,
        totalAmount,
        products: productLines,
      },
    });
  } catch (error) {
    console.error("Error processing file:", error);
    res.status(500).json({ error: "Error processing file." });
  } finally {
    deleteFile(filePath);
  }
});

// API to handle Excel export
app.post("/export", async (req, res) => {
  const { invoiceData } = req.body;

  if (!invoiceData || !invoiceData.products) {
    return res.status(400).json({ error: "Invalid invoice data for export." });
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Invoice Data");

  // Add invoice details
  worksheet.addRow(["Invoice Number:", invoiceData.invoiceNumber]);
  worksheet.addRow(["Date:", invoiceData.date]);
  worksheet.addRow(["Customer Name:", invoiceData.customerName]);
  worksheet.addRow([]); // Empty row for spacing

  // Add table headers
  worksheet.addRow(["Product", "Qty", "Price", "Total"]);

  // Add product rows
  invoiceData.products.forEach((product) => {
    worksheet.addRow([
      product.product,
      product.qty,
      product.price,
      product.total,
    ]);
  });

  // Add grand total
  worksheet.addRow([]); // Empty row for spacing
  worksheet.addRow(["Grand Total:", "", "", invoiceData.totalAmount]);

  // Set response headers for Excel file download
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=" + "invoice-data.xlsx"
  );

  await workbook.xlsx.write(res);
  res.end();
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});