export default async function handler(req, res) {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  // body가 string이면 파싱
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) { return res.status(400).json({ error: 'Invalid JSON body' }); }
  }

  const { lyrics, apiKey, duration, durationSec, genre, subGenres, bpm } = body || {};

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
${genreTxt ? '- ' + genreTxt : ''}
${bpmTxt ? '- ' + bpmTxt : ''}

가사:
${lyrics}

가사를 분석해서 유튜브 타임스탬프를 JSON으로 생성하세요.

규칙:
1. 인트로, 1절, 2절, 코러스, 브릿지, 아웃트로 등 구간 파악
2. 음악 길이와 BPM을 고려해 각 구간 시작 시간을 MM:SS 형식으로 추정
3. 일반 구조 참고: 인트로 10-15초, 각 절 30-45초, 코러스 20-30초
4. [1절], [코러스] 같은 태그가 가사에 있으면 그 구조를 우선 사용
5. 반드시 아래 형식의 JSON만 반환. 마크다운 코드블록 없이 순수 JSON.

반환 형식:
{"timestamps":[{"time":"0:00","section":"인트로","icon":"🎵","desc":"짧은설명"},{"time":"0:15","section":"1절","icon":"🎤","desc":"첫가사"}],"youtubeText":"0:00 인트로\n0:15 1절","analysisNote":"분석메모"}`;

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
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const rawText = await anthropicRes.text();

    if (!anthropicRes.ok) {
      let errMsg = 'Anthropic API error';
      try { errMsg = JSON.parse(rawText).error?.message || errMsg; } catch(_) {}
      return res.status(anthropicRes.status).json({ error: errMsg });
    }

    let data;
    try { data = JSON.parse(rawText); }
    catch(e) { return res.status(500).json({ error: 'Anthropic 응답 파싱 실패: ' + rawText.slice(0, 200) }); }

    const text = data.content?.[0]?.text || '';
    if (!text) return res.status(500).json({ error: 'Anthropic 응답 내용 없음' });

    // JSON 추출 (```json ... ``` 또는 순수 JSON)
    let clean = text.trim();
    const jsonMatch = clean.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) clean = jsonMatch[1].trim();

    let result;
    try { result = JSON.parse(clean); }
    catch(e) {
      // JSON 블록만 추출 시도
      const objMatch = clean.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { result = JSON.parse(objMatch[0]); }
        catch(_) { return res.status(500).json({ error: 'JSON 파싱 실패: ' + clean.slice(0, 300) }); }
      } else {
        return res.status(500).json({ error: 'JSON 파싱 실패: ' + clean.slice(0, 300) });
      }
    }

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: '서버 오류: ' + err.message });
  }
}
