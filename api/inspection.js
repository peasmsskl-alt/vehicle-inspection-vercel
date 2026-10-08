const { appendValues } = require('../lib/sheets');

export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method Not Allowed'
    });
  }

  try {

    const d = req.body || {};

    if (!d.plate) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุเลขทะเบียน'
      });
    }

    if (!d.inspector) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุชื่อผู้ตรวจ'
      });
    }

    // =========================
    // ผลตรวจแต่ละข้อ
    // =========================

    const results = Array.isArray(d.results)
      ? d.results
      : [];

    const defectCount = results.filter(
      item => item.result === 'ไม่ผ่าน'
    ).length;

    const passCount = results.filter(
      item => item.result === 'ผ่าน'
    ).length;

    const naCount = results.filter(
      item => item.result === 'ไม่เกี่ยวข้อง'
    ).length;

    const totalItems = results.length;

    const overall =
      defectCount > 0
        ? 'พบข้อบกพร่อง'
        : 'ปกติ';

    // =========================
    // บันทึกลง Google Sheet
    // =========================

    await appendValues(
      'Inspections!A:R',
      [

        new Date().toISOString(), // A วันที่บันทึก

        d.date || '',             // B วันที่ตรวจ

        d.plate || '',            // C เลขทะเบียน

        d.type || '',             // D ประเภทรถ

        d.department || '',       // E หน่วยงาน

        d.model || '',            // F ยี่ห้อ/รุ่น

        d.inspector || '',        // G ผู้ตรวจ

        overall,                  // H ผลรวม

        defectCount,              // I จำนวนข้อบกพร่อง

        d.notes || '',            // J หมายเหตุ

        JSON.stringify(results),  // K ผลตรวจทุกข้อ

        d.mileage ?? '',          // L เลขไมล์

        d.usageType || '',        // M ลักษณะการใช้งาน

        d.shift || '',            // N กะ

        d.operatingStatus || '',  // O สถานะการใช้งาน

        totalItems,               // P จำนวนข้อทั้งหมด

        passCount,                // Q จำนวนข้อผ่าน

        naCount                   // R จำนวนข้อไม่เกี่ยวข้อง

      ]
    );

    return res.status(200).json({

      success: true,

      overall,

      defectCount,

      passCount,

      naCount,

      totalItems

    });

  } catch (e) {

    console.error('inspection error:', e);

    return res.status(500).json({

      success: false,

      message: e.message

    });

  }

}
