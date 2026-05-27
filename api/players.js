export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  const token = process.env.AIRTABLE_TOKEN
  const baseId = process.env.AIRTABLE_BASE_ID
  const tableId = process.env.AIRTABLE_TABLE_ID

  if (!token || !baseId || !tableId) {
    return res.status(500).json({
      error: "Missing Airtable environment variables",
    })
  }

  try {
    let allRecords = []
    let offset = null

    do {
      const url = new URL(
        `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableId)}`
      )

      url.searchParams.set("pageSize", "100")
      url.searchParams.set("sort[0][field]", "Learn Priority")
      url.searchParams.set("sort[0][direction]", "desc")
      url.searchParams.set("filterByFormula", "{Published}=TRUE()")

      if (offset) {
        url.searchParams.set("offset", offset)
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const text = await response.text()
        return res.status(response.status).json({
          error: "Airtable request failed",
          details: text,
        })
      }

      const data = await response.json()
      allRecords = allRecords.concat(data.records || [])
      offset = data.offset
    } while (offset)

    const players = allRecords.map((record) => {
      const f = record.fields || {}

      return {
        id: f.Slug || record.id,
        name: f.Name || "",
        league: f.League || "",
        position: f.Position || "",
        team: f.Team || "",
        nationality: f.Nationality || "",
        number: f.Number !== undefined ? String(f.Number) : "",
        nickname: f.Nickname || "",
        ratingLabel: f["Rating Label"] || "",
        ratingNumeric: f["Rating Numeric"] || null,
        summary: f.Summary || "",
        tier: f.Tier || "",
        learnPriority: f["Learn Priority"] || 0,
        memoryLens: f["Memory Lens"] || "",
        tags: Array.isArray(f.Tags) ? f.Tags : [],
        image: f["Image URL"] || "",
        avatarPrompt: f["Avatar Prompt"] || "",
        colors: [f["Color 1"], f["Color 2"], f["Color 3"]].filter(Boolean),
        lastReviewed: f["Last Reviewed"] || "",
      }
    })

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600")

    return res.status(200).json(players)
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    })
  }
}
