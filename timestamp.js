export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lyrics, apiKey, duration, durationSec, genre, subGenres, bpm } = req.body;

  if (!apiKey) return res.status(400).json({ error: 'API key required' });
  if (!lyrics) return res.status(400).json({ error: 'Lyrics required' });

  const durTxt = duration
    ? `음악 총 길이: ${duration} (${durationSec}초)`
    : '음악 길이: 알 수 없음 (3-4분 기준 추정)';
  const genreTxt = genre ? `장르: ${genre}, 세부: ${subGenres || ''}` : '';
  const bpmTxt = bpm ? `BPM: ${bpm}` : '';

  const prompt = `음악 타임스탬프 전문가입니다.

음원 정보:
- ${durTxt}
- ${genreTxt}
- ${bpmTxt}

가사:
${lyrics}

가사를 분석해서 유튜브 타임스탬프를 생성하세요.

규칙:
1. 인트로·1절·2절·코러스·브릿지·아웃트로 등 구간 파악
2. 음악 길이와 BPM 고려해 각 구간 시작 시간 추정
3. 일반 구조: 인트로 10-15초, 절 30-45초, 코러스 20-30초
4. [1절][코러스] 같은 태그가 있으면 그 구조 우선 사용
5. 순수 JSON만 반환. 마크다운 없이.

JSON:
{"timestamps":[{"time":"0:00","section":"인트로","icon":"🎵","desc":"설명"},{"time":"0:15","section":"1절","icon":"🎤","desc":"첫 가사..."}],"youtubeText":"0:00 인트로\\n0:15 1절\\n...","analysisNote":"구조 분석 메모"}`;

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
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
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
