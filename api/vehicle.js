const { getValues } = require('../lib/sheets');

export default async function handler(req, res) {
  try {
    const plate = String(req.query.plate || '').trim();
    const type = String(req.query.type || '').trim();

    const rows = await getValues('Vehicles!A:E');

    if (!rows.length) {
      return res.status(500).json({
        success: false,
        message: 'ชีต Vehicles ยังไม่มีข้อมูล'
      });
    }

    const headers = rows[0];
    const idx = Object.fromEntries(
      headers.map((x, i) => [String(x).trim(), i])
    );

    const vehicles = rows
      .slice(1)
      .filter(row => {
        // ถ้ามีคอลัมน์ "ใช้งาน" และเป็น FALSE ให้ไม่แสดง
        if (
          idx['ใช้งาน'] !== undefined &&
          String(row[idx['ใช้งาน']] ?? '').trim().toUpperCase() === 'FALSE'
        ) {
          return false;
        }

        // ถ้าเลือกประเภท ให้กรองตามประเภท
        if (type) {
          return (
            String(row[idx['ประเภทรถ']] ?? '').trim() === type
          );
        }

        return true;
      })
      .map(row => ({
        plate: row[idx['เลขทะเบียน']] || '',
        type: row[idx['ประเภทรถ']] || '',
        department: row[idx['หน่วยงาน']] || '',
        model: row[idx['ยี่ห้อ/รุ่น']] || ''
      }));

    // ค้นหาด้วยทะเบียน
    if (plate) {
      const vehicle = vehicles.find(
        item =>
          String(item.plate).trim() === plate
      );

      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบทะเบียน ' + plate
        });
      }

      return res.status(200).json({
        success: true,
        vehicle
      });
    }

    // โหลดทะเบียนตามประเภท และตัดทะเบียนซ้ำ
    const seen = new Set();
    const uniqueVehicles = vehicles.filter(vehicle => {
      const key = String(vehicle.plate).trim();

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

    return res.status(200).json({
      success: true,
      vehicles: uniqueVehicles
    });

  } catch (e) {
    return res.status(500).json({
      success: false,
      message: e.message
    });
  }
}
