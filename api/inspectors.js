const { getValues } = require('../lib/sheets');

export default async function handler(req, res) {
  try {
    const type = String(req.query.type || '').trim();

    const rows = await getValues('Inspectors!A:C');

    if (!rows.length) {
      return res.status(500).json({
        success: false,
        message: 'ชีต Inspectors ยังไม่มีข้อมูล'
      });
    }

    const headers = rows[0];

    const idx = Object.fromEntries(
      headers.map((x, i) => [String(x).trim(), i])
    );

    const inspectors = rows
      .slice(1)
      .filter(row => {

        // ไม่เอาคนที่ปิดการใช้งาน
        if (
          idx['ใช้งาน'] !== undefined &&
          String(row[idx['ใช้งาน']] ?? '')
            .trim()
            .toUpperCase() === 'FALSE'
        ) {
          return false;
        }

        // กรองตามประเภทรถ
        if (type) {
          return (
            String(row[idx['ประเภทรถ']] ?? '').trim() === type
          );
        }

        return true;
      })
      .map(row => ({
        name: String(row[idx['ชื่อผู้ตรวจ']] ?? '').trim(),
        type: String(row[idx['ประเภทรถ']] ?? '').trim()
      }))
      .filter(item => item.name);

    // ตัดชื่อซ้ำ
    const seen = new Set();

    const uniqueInspectors = inspectors.filter(item => {
      const key = item.name + '|' + item.type;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

    return res.status(200).json({
      success: true,
      inspectors: uniqueInspectors
    });

  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message
    });
  }
}
