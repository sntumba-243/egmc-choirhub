export default async function handler(req, res) {
  const { fileId } = req.query
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return res.status(400).json({ error: 'Invalid fileId' })
  }
  try {
    // Fetch from Google Drive server-side — no CORS restriction here
    const driveUrl = 'https://drive.google.com/uc?export=download&id=' + fileId
    let response = await fetch(driveUrl, { redirect: 'follow' })

    // Handle Drive virus-scan interstitial for larger files
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/html')) {
      const html = await response.text()
      const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/)
      const confirm = confirmMatch ? confirmMatch[1] : 't'
      response = await fetch(driveUrl + '&confirm=' + confirm, { redirect: 'follow' })
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Drive fetch failed' })
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).send(buffer)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
