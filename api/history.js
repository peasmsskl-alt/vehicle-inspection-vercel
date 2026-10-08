const { getValues } = require('../lib/sheets');

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

    const plate = String(
      req.query.plate || ''
    ).trim();

    const date = String(
      req.query.date || ''
    ).trim();

    const month = String(
      req.query.month || ''
    ).trim();

    const rows = await getValues(
      'Inspections!A:R'
    );

    const items = rows
      .slice(1)
      .filter(row => {

        const rowDate =
          String(row[1] || '').trim();

        const rowPlate =
          String(row[2] || '').trim();

        if (
          plate &&
          rowPlate !== plate
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

          defectCount:
            Number(row[8] || 0),

          notes: row[9] || '',

          results: results,

          mileage: row[11] || '',

          usageType: row[12] || '',

          shift: row[13] || '',

          operatingStatus: row[14] || '',

          totalItems:
            Number(row[15] || results.length || 0),

          passCount:
            Number(row[16] || 0),

          naCount:
            Number(row[17] || 0)

        };

      });

    // =========================
    // สรุป
    // =========================

    const summary = {

      inspections: items.length,

      passed: items.filter(
        item =>
          item.status === 'ปกติ'
      ).length,

      abnormal: items.filter(
        item =>
          item.status === 'พบข้อบกพร่อง'
      ).length,

      defects: items.reduce(
        (sum, item) =>
          sum + Number(item.defectCount || 0),
        0
      ),

      vehicles: [
        ...new Set(
          items
            .map(item => item.plate)
            .filter(Boolean)
        )
      ].length

    };

    return res.status(200).json({

      success: true,

      items,

      summary

    });

  } catch (e) {

    console.error('history error:', e);

    return res.status(500).json({

      success: false,

      message: e.message

    });

  }

}
