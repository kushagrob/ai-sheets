export async function GET() {
  try {
    // Get the last updated workbook from global store
    const updatedWorkbook = (global as any).lastUpdatedWorkbook
    
    if (updatedWorkbook) {
      return new Response(JSON.stringify(updatedWorkbook), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response('No updated workbook found', { status: 404 })
  } catch (error) {
    console.error('Workbook API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}