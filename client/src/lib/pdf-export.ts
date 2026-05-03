export async function downloadPdf(url: string, filename: string, body?: any): Promise<void> {
  const method = body !== undefined ? 'POST' : 'GET';
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'PDF-Export fehlgeschlagen' }));
    throw new Error(err.message || 'PDF-Export fehlgeschlagen');
  }

  const html = await response.text();
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup wurde blockiert. Bitte erlauben Sie Popups für diese Seite.');
  }
  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}
