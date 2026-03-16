const fs = require('fs');
const puppeteer = require('puppeteer');
const { marked } = require('marked');
const path = require('path');

const css = `
  body {
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px;
  }
  h1 {
    color: #2c3e50;
    border-bottom: 2px solid #3498db;
    padding-bottom: 10px;
    text-align: center;
  }
  h2 {
    color: #2980b9;
    margin-top: 30px;
    border-bottom: 1px solid #eee;
    padding-bottom: 5px;
  }
  h3 {
    color: #34495e;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    font-size: 14px;
  }
  th, td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #ddd;
  }
  th {
    background-color: #f8f9fa;
    color: #2c3e50;
    font-weight: 600;
  }
  tr:hover {
    background-color: #f5f5f5;
  }
  .success {
    color: #27ae60;
    font-weight: bold;
  }
  blockquote {
    border-left: 4px solid #f39c12;
    background-color: #fcf6e3;
    margin: 20px 0;
    padding: 15px;
    font-style: italic;
  }
  hr {
    border: 0;
    height: 1px;
    background: #e0e0e0;
    margin: 30px 0;
  }
  .header-logo {
    text-align: center;
    margin-bottom: 20px;
  }
`;

async function generatePdf() {
  const mdPath = 'C:\\Users\\pranav\\.gemini\\antigravity\\brain\\45b5fe1f-740b-4d3e-8b24-e333825f597f\\cartr_project_progress_report.md';
  const pdfPath = 'C:\\Users\\pranav\\Desktop\\catr-latest\\cart-r\\CARTR_Progress_Report.pdf';

  try {
    console.log('Reading markdown...');
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    
    // Customize marked to add class for ✅ Marks
    const renderer = new marked.Renderer();
    const originalTablecell = renderer.tablecell.bind(renderer);
    renderer.tablecell = ({ content, header }) => {
      // Pass the argument as an object correctly matching the new marked spec if there's type changes,
      // but simpler: we just string replace post-render
      return typeof originalTablecell === 'function' ? originalTablecell({content, header}) : null;
    };
    
    // Using string replace to style ✅ Completed
    let htmlContent = marked.parse(mdContent);
    htmlContent = htmlContent.replace(/✅ Completed/g, '<span class="success">✅ Completed</span>');

    const html = \`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>\${css}</style>
      </head>
      <body>
        <div class="header-logo">
          <h1 style="border: none; margin-bottom: 0;">🚗 CARTR</h1>
          <p style="color: #7f8c8d; margin-top: 5px;">A Modern Ride-Hailing & Goods Delivery Platform</p>
        </div>
        \${htmlContent}
      </body>
      </html>
    \`;

    fs.writeFileSync('temp.html', html);

    console.log('Launching puppeteer...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    console.log('Setting HTML content...');
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    console.log('Generating PDF...');
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      },
      printBackground: true
    });
    
    await browser.close();
    console.log(\`PDF generated successfully at \${pdfPath}\`);
  } catch (error) {
    console.error('Error generating PDF:', error);
  }
}

generatePdf();
