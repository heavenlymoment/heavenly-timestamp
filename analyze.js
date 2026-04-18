export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }

  const { filename, duration, apiKey } = body || {};
  if (!apiKey) return res.status(400).json({ error: 'API key required' });

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 600,
        system: '음악 분석 전문가. 반드시 순수 JSON만 반환. 마크다운 없이.\n형식: {"mainGenre":"주장르","subGenres":["세부1","세부2"],"bpm":"약 XXX BPM","key":"XX장조/단조","chordProgression":"코드진행","harmonyFeature":"화성특징","description":"곡 분위기 2-3문장"}',
        messages: [
          {
            role: 'user',
            content: `파일명: ${filename || '알 수 없음'}\n길이: ${duration || '알 수 없음'}\n이 음원의 파일명을 기반으로 장르·BPM·조성·화성 구조를 추정해주세요.`,
          },
        ],
      }),
    });

    const rawText = await anthropicRes.text();

    if (!anthropicRes.ok) {
      let errMsg = 'API error';
      try { errMsg = JSON.parse(rawText).error?.message || errMsg; } catch(_) {}
      return res.status(anthropicRes.status).json({ error: errMsg });
    }

    const data = JSON.parse(rawText);
    const text = data.content?.[0]?.text || '';

    let clean = text.trim();
    const jsonMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) clean = jsonMatch[1].trim();

    let result;
    try { result = JSON.parse(clean); }
    catch(e) {
      const objMatch = clean.match(/\{[\s\S]*\}/);
      if (objMatch) result = JSON.parse(objMatch[0]);
      else return res.status(500).json({ error: 'JSON 파싱 실패' });
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
