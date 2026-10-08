const { getValues } = require('../lib/sheets');

const REPAIR_VEHICLES = [
  '81-9152 สข',
  '3ฒง 9030 กทม',
  '82-8020 สข'
];

function matchDate(dateValue, date) {
  if (!date) return true;
  return String(dateValue || '').trim() === date;
}

function matchMonth(dateValue, month) {
  if (!month) return true;

  return String(dateValue || '')
    .trim()
    .startsWith(month);
}

export default async function handler(req, res) {

  try {

    const plate =
      String(req.query.plate || '').trim();

    const date =
      String(req.query.date || '').trim();

    const month =
      String(req.query.month || '').trim();

    const rows =
      await getValues('Inspections!A:R');

    const items =
      rows
        .slice(1)
        .filter(row => {

          const rowDate =
            String(row[1] || '').trim();

          const rowPlate =
            String(row[2] || '').trim();

          // ค้นหาทะเบียนแบบพิมพ์บางส่วนได้
          // เช่น 0164 → 81-0164 สข
          if (
            plate &&
            !rowPlate.includes(plate)
          ) {
            return false;
          }

          if (
            date &&
            !matchDate(rowDate, date)
          ) {
            return false;
          }

          if (
            month &&
            !matchMonth(rowDate, month)
          ) {
            return false;
          }

          return true;

        })
        .reverse()
        .map(row => {

          let results = [];

          try {

            results =
              row[10]
                ? JSON.parse(row[10])
                : [];

          } catch (e) {

            results = [];

          }

          return {

            timestamp: row[0] || '',
            date: row[1] || '',
            plate: row[2] || '',
            type: row[3] || '',
            department: row[4] || '',
            model: row[5] || '',
            inspector: row[6] || '',
            status: row[7] || '',
            defectCount: Number(row[8] || 0),
            notes: row[9] || '',

            results,

            mileage: row[11] || '',
            usageType: row[12] || '',
            shift: row[13] || '',
            operatingStatus: row[14] || '',

            totalItems:
              Number(
                row[15] ||
                results.length ||
                0
              ),

            passCount:
              Number(row[16] || 0),

            naCount:
              Number(row[17] || 0)

          };

        });

    // ========================================
    // สรุปภาพรวม
    // ========================================

    const summary = {

      inspections:
        items.length,

      passed:
        items.filter(
          x => x.status === 'ปกติ'
        ).length,

      abnormal:
        items.filter(
          x => x.status === 'พบข้อบกพร่อง'
        ).length,

      defects:
        items.reduce(
          (sum, x) =>
            sum +
            Number(x.defectCount || 0),
          0
        ),

      vehicles:
        new Set(
          items
            .map(x => x.plate)
            .filter(Boolean)
        ).size

    };


    // ========================================
    // สรุปตามรถ
    // ========================================

    const vehicleMap = {};

    items.forEach(item => {

      const key = item.plate;

      if (!key) return;

      if (!vehicleMap[key]) {

        vehicleMap[key] = {

          plate: key,

          type: item.type || '',

          total: 0,

          passed: 0,

          abnormal: 0,

          defects: 0,

          shift1: 0,

          shift2: 0,

          shift3: 0

        };

      }

      const v =
        vehicleMap[key];

      v.total++;

      if (
        item.status === 'ปกติ'
      ) {
        v.passed++;
      }

      if (
        item.status ===
        'พบข้อบกพร่อง'
      ) {
        v.abnormal++;
      }

      v.defects +=
        Number(
          item.defectCount || 0
        );

      if (
        item.shift === 'กะที่ 1'
      ) {
        v.shift1++;
      }

      if (
        item.shift === 'กะที่ 2'
      ) {
        v.shift2++;
      }

      if (
        item.shift === 'กะที่ 3'
      ) {
        v.shift3++;
      }

    });


    const vehicles =
      Object.values(
        vehicleMap
      );


    // ========================================
    // ข้อบกพร่องที่พบบ่อย
    // ========================================

    const defectMap = {};

    items.forEach(item => {

      const results =
        Array.isArray(item.results)
          ? item.results
          : [];

      results.forEach(result => {

        if (
          result.result !== 'ไม่ผ่าน'
        ) {
          return;
        }

        const name =
          result.name ||
          'ไม่ระบุรายการ';

        if (
          !defectMap[name]
        ) {
          defectMap[name] = 0;
        }

        defectMap[name]++;

      });

    });


    const topDefects =
      Object.entries(defectMap)
        .map(([name, count]) => ({
          name,
          count
        }))
        .sort(
          (a, b) =>
            b.count - a.count
        )
        .slice(0, 10);


    // ========================================
    // สรุป 3 คันงานแก้ไฟ
    // ========================================

    const repairSummary =
      REPAIR_VEHICLES.map(plate => {

        const found =
          vehicleMap[plate];

        return {

          plate,

          total:
            found?.total || 0,

          shift1:
            found?.shift1 || 0,

          shift2:
            found?.shift2 || 0,

          shift3:
            found?.shift3 || 0

        };

      });


    return res.status(200).json({

      success: true,

      items,

      summary,

      vehicles,

      topDefects,

      repairSummary

    });


  } catch (e) {

    console.error(
      'history error:',
      e
    );

    return res.status(500).json({

      success: false,

      message: e.message

    });

  }

}
