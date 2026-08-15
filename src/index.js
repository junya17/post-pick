// Worker 本体。/api/pick だけ自分で処理し、それ以外は public/ の静的ファイルを返す。
// Secret: ANTHROPIC_API_KEY（必須）, PASSCODE（任意）

const MODEL = "claude-sonnet-5";
const MAX_IMAGES = 6;

const SYSTEM = `あなたは写真の編集者です。撮影者が同じ撮影から持ち帰った候補を見て、どれを投稿するか一枚だけ決めます。

作品としての完成度ではなく、その媒体のタイムラインで機能するかで選ぶこと。両者は一致しないことが多い。

【選ぶときの判断材料】
・幅400px程度に縮んでも主題が読めるか。小さくして潰れる写真は選ばない
・0.5秒で何の写真か分かるか。説明を要する写真は流される
・色や光に異物感があるか。整っているだけの写真は止まらない
・「どこ？」「いつ？」と訊きたくなる引っかかりがあるか
・既視感。同じ構図を何度も見ている題材は不利

【守ること】
・一枚に決める。迷いを書かない
・選ばなかった写真には、なぜ負けたかを書く。褒め言葉は要らない
・キャプションは写真から言えることだけ。撮影者が言っていない事実を作らない
・トリミングは媒体に合わせる。指定がなければ縦4:5を基準に考える
・reach は0〜100。全部が高得点になることはない。静かで良い写真ほど低く出てよい

【出力】次のJSONのみを返す。前置き・コードフェンス・説明は書かない。字数は厳守する。
{"pick":選んだ写真の番号,"why":"それを選んだ理由（60字以内）","crop":"推奨トリミングと切る位置（40字以内）","caption":"キャプションの切り口。写真から言えることだけ（50字以内）","cut":"投稿前に直す一点（50字以内）","ranking":[{"n":番号,"reach":数値,"note":"その順位の理由（40字以内）"}]}

ranking には渡された全ての写真を reach の高い順に入れる。pick は ranking の先頭と一致させる。`;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/pick") {
      if (request.method !== "POST") return json({ error: "POST のみです" }, 405);
      return handlePick(request, env);
    }

    // それ以外は public/ の静的ファイル
    return env.ASSETS.fetch(request);
  },
};

async function handlePick(request, env) {
  if (env.PASSCODE && request.headers.get("x-passcode") !== env.PASSCODE) {
    return json({ error: "unauthorized" }, 401);
  }
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "ANTHROPIC_API_KEY が設定されていません" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "不正なリクエストです" }, 400);
  }

  const images = Array.isArray(body.images) ? body.images : [];
  if (images.length < 2) return json({ error: "写真が2枚以上必要です" }, 400);
  if (images.length > MAX_IMAGES) {
    return json({ error: `写真は${MAX_IMAGES}枚までです` }, 400);
  }

  // 1枚ずつ番号を宣言してから画像を置く。番号と写真の対応がずれないようにするため
  const content = [];
  images.forEach((data, i) => {
    content.push({ type: "text", text: `${i + 1}枚目` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data },
    });
  });

  const venue = body.venue ? `出す先：${body.venue}` : "出す先：指定なし";
  const note = body.note ? `\n撮影者のメモ：${body.note}` : "";
  content.push({
    type: "text",
    text: `以上${images.length}枚から、投稿する一枚を選んでください。\n${venue}${note}`,
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return json({ error: "API エラー", detail: detail.slice(0, 500) }, res.status);
  }
  return json(await res.json());
}
