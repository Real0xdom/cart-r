import zipfile
import xml.etree.ElementTree as ET

try:
    with zipfile.ZipFile('Cartr_Bug_Report (1).docx') as z:
        xml_content = z.read('word/document.xml')
        tree = ET.fromstring(xml_content)
        namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        texts = tree.findall('.//w:t', namespaces)
        with open('docx_content.txt', 'w', encoding='utf-8') as f:
            f.write('\n'.join(t.text for t in texts if t.text))
    print("Success")
except Exception as e:
    print("Error:", e)
