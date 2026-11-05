// Proxy de IP fixo para a PlayFiver.
//
// Roda na sua VPS e repassa as chamadas da Avesbet para a PlayFiver saindo pelo
// IP fixo do servidor — que é o IP que a PlayFiver precisa liberar.
//
// Como rodar:  node playfiver-proxy.js
// Variáveis:   PORT (padrão 3000) · PROXY_TOKEN (opcional, mas recomendado)
//
// Abrir a URL no navegador (GET) responde com o IP de saída do servidor.

import http from "node:http";
import https from "node:https";

const PORT = Number(process.env.PORT || 3000);
const TOKEN = (process.env.PROXY_TOKEN || "").trim();

// Só aceita destino na PlayFiver: o proxy nunca repassa para outro site.
const ALLOWED = /(^|\.)playfivers?\.com$/i;

const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

// IP público da VPS: é este que você envia à PlayFiver para liberação.
const showIp = async (res) => {
  const ip = await fetch("https://api.ipify.org")
    .then((response) => response.text())
    .catch(() => "");
  send(res, 200, JSON.stringify({ ok: true, ip: ip.trim() }, null, 2));
};

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") return showIp(res);

  if (TOKEN && String(req.headers["x-proxy-token"] || "") !== TOKEN) {
    return send(res, 401, JSON.stringify({ error: "token do proxy inválido" }));
  }

  let target;
  try {
    target = new URL(String(req.headers["x-proxy-target"] || ""));
  } catch {
    return send(res, 400, JSON.stringify({ error: "destino inválido" }));
  }

  if (target.protocol !== "https:" || !ALLOWED.test(target.hostname)) {
    return send(res, 403, JSON.stringify({ error: "destino não permitido" }));
  }

  const body = await readBody(req);

  const upstream = https.request(
    {
      method: "POST",
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
        Accept: "application/json",
        "Content-Length": body.length,
      },
    },
    (response) => {
      res.writeHead(response.statusCode || 502, {
        "Content-Type": response.headers["content-type"] || "application/json",
      });
      response.pipe(res);
    },
  );

  upstream.on("error", () => send(res, 502, JSON.stringify({ error: "falha ao alcançar a PlayFiver" })));
  upstream.end(body);
});

server.listen(PORT, () => console.log(`Proxy PlayFiver ativo na porta ${PORT}`));
