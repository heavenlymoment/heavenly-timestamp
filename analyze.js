export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { filename, duration, apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'API key required' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: '음악 분석 전문가. 반드시 순수 JSON만 반환. 마크다운 없이.\n형식: {"mainGenre":"주장르","subGenres":["세부1","세부2"],"bpm":"약 XXX BPM","key":"XX장조/단조","chordProgression":"코드진행","harmonyFeature":"화성특징","description":"곡 분위기 2-3문장"}',
        messages: [
          {
            role: 'user',
            content: `파일명: ${filename}\n길이: ${duration}\n이 음원의 파일명을 기반으로 장르·BPM·조성·화성 구조를 추정해주세요.`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API error' });
    }

    const text = data.content?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
