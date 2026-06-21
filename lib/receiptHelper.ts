import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const downloadReceiptPDF = async (orderId: string, items: any[], grandTotal: number, studentName: string) => {
  const currentDate = new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 6px 0;">${item.quantity}x ${item.name || item.food_name}</td>
      <td style="text-align: right; padding: 6px 0;">₱${(item.price * item.quantity || item.unit_price * item.quantity).toFixed(2)}</td>
    </tr>
    ${item.note ? `<tr><td colspan="2" style="font-size: 11px; color: #6b7280; font-style: italic; padding-bottom: 4px;">&nbsp;&nbsp;✍️ "${item.note}"</td></tr>` : ''}
  `).join('');

  const htmlContent = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 24px; color: #1f2937; }
          .header { text-align: center; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: 800; margin-bottom: 4px; color: #ff4d4d; }
          .meta-info { font-size: 13px; color: #4b5563; margin-bottom: 2px; }
          .divider { border-top: 1px dashed #cbd5e1; margin: 16px 0; }
          table { width: 100%; border-collapse: collapse; }
          th { text-align: left; font-size: 12px; color: #9ca3af; text-transform: uppercase; padding-bottom: 8px; }
          .total-row { font-size: 16px; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">CAMPUS CANTEEN RECEIPT</div>
          <div class="meta-info">Order ID: ${orderId.slice(0, 8).toUpperCase()}</div>
          <div class="meta-info">${currentDate}</div>
        </div>
        <div class="divider"></div>
        <div style="margin-bottom: 12px;">
          <span style="font-size: 13px; color: #6b7280;">Student Name:</span>
          <div style="font-size: 15px; font-weight: 700; color: #111827;">${studentName}</div>
        </div>
        <div class="divider"></div>
        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        <div class="divider"></div>
        <table>
          <tr class="total-row">
            <td>Total Amount Due</td>
            <td style="text-align: right; color: #ff4d4d;">₱${grandTotal.toFixed(2)}</td>
          </tr>
        </table>
        <div class="footer">
          <p>Thank you for ordering!<br>Present this mobile slip at the counter to claim.</p>
        </div>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogueTitle: 'Download Student Receipt' });
  } catch (error) {
    console.error("PDF Export Failure Tracker:", error);
    alert("Could not generate downloadable file context asset.");
  }
};