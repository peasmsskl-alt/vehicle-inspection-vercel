const { getValues } = require('../lib/sheets');

export default async function handler(req, res) {

  try {

    const plate = String(
      req.query.plate || ''
    ).trim();

    const type = String(
      req.query.type || ''
    ).trim();


    const rows = await getValues(
      'Vehicles!A:E'
    );


    if (!rows.length) {
      return res.status(500).json({
        success: false,
        message: 'ชีต Vehicles ยังไม่มีข้อมูล'
      });
    }


    const h = rows[0];

    const idx = Object.fromEntries(
      h.map((x, i) => [
        String(x).trim(),
        i
      ])
    );


    const vehicles = rows
      .slice(1)
      .filter(row => {

        // ข้ามรถที่ปิดการใช้งาน
        if (
          idx['ใช้งาน'] !== undefined &&
          String(
            row[idx['ใช้งาน']]
          ).toUpperCase() === 'FALSE'
        ) {
          return false;
        }


        // ถ้ามีการเลือกประเภท
        if (type) {

          return String(
            row[idx['ประเภทรถ']] ?? ''
          ).trim() === type;

        }


        return true;

      })
      .map(row => ({

        plate:
          row[idx['เลขทะเบียน']] || '',

        type:
          row[idx['ประเภทรถ']] || '',

        department:
          row[idx['หน่วยงาน']] || '',

        model:
          row[idx['ยี่ห้อ/รุ่น']] || ''

      }));


    // ==========================================
    // กรณีต้องการ "รายการทะเบียน"
    // /api/vehicle?type=รถยก
    // ==========================================

    if (!plate) {

      return res.status(200).json({
        success: true,
        vehicles
      });

    }


    // ==========================================
    // กรณีเลือกทะเบียน
    // /api/vehicle?plate=80-1234
    // ==========================================

    const vehicle = vehicles.find(
      x =>
        String(x.plate).trim() === plate
    );


    if (!vehicle) {

      return res.status(404).json({
        success: false,
        message:
          'ไม่พบทะเบียน ' + plate
      });

    }


    return res.status(200).json({

      success: true,

      vehicle

    });


  } catch (e) {

    return res.status(500).json({

      success: false,

      message: e.message

    });

  }

}
