// 1. Pegando os elementos do HTML
const form = document.getElementById("form");
const inputCidade = document.getElementById("cidade");
const btnUnidade = document.getElementById("unidade");
const mensagem = document.getElementById("mensagem");
const resultado = document.getElementById("resultado");
const nome = document.getElementById("nome");
const temp = document.getElementById("temp");
const descricao = document.getElementById("descricao");
const detalhes = document.getElementById("detalhes");

// 2. Estado do app (dados que mudam)
let celsius = true;
let dados = null; // guarda o último resultado

// 3. Traduz o código do clima da API para texto
function traduzCodigo(codigo) {
  if (codigo === 0) return "☀️ Céu limpo";
  if (codigo <= 3) return "⛅ Parcialmente nublado";
  if (codigo <= 48) return "🌫️ Neblina";
  if (codigo <= 57) return "🌦️ Garoa";
  if (codigo <= 67) return "🌧️ Chuva";
  if (codigo <= 77) return "❄️ Neve";
  if (codigo <= 82) return "🌧️ Pancadas de chuva";
  return "⛈️ Tempestade";
}

// 4. Busca os dados (async/await + fetch)
async function buscarClima(cidade) {
  // Passo 1: transforma o nome da cidade em latitude/longitude
  const urlGeo = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt`;
  const respGeo = await fetch(urlGeo);
  const geo = await respGeo.json();

  if (!geo.results) throw new Error("Cidade não encontrada.");
  const { latitude, longitude, name, country } = geo.results[0];

  // Passo 2: busca o clima atual com as coordenadas
  const urlClima = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
  const respClima = await fetch(urlClima);
  if (!respClima.ok) throw new Error("Erro ao buscar o clima.");
  const clima = await respClima.json();

  return { cidade: `${name}, ${country}`, atual: clima.current };
}

// 5. Mostra os dados na tela
function mostrar() {
  const c = dados.atual.temperature_2m;
  const valor = celsius ? c : (c * 9) / 5 + 32; // fórmula °C → °F

  nome.textContent = dados.cidade;
  temp.textContent = `${valor.toFixed(1)}°${celsius ? "C" : "F"}`;
  descricao.textContent = traduzCodigo(dados.atual.weather_code);
  detalhes.textContent = `💧 ${dados.atual.relative_humidity_2m}%  |  💨 ${dados.atual.wind_speed_10m} km/h`;
  resultado.hidden = false;
}

// 6. Eventos (reagem às ações do usuário)
form.addEventListener("submit", async (e) => {
  e.preventDefault();               // impede a página de recarregar
  mensagem.textContent = "Buscando...";
  try {
    dados = await buscarClima(inputCidade.value.trim());
    mensagem.textContent = "";
    mostrar();
  } catch (erro) {
    resultado.hidden = true;
    mensagem.textContent = erro.message; // mostra o erro ao usuário
  }
});

btnUnidade.addEventListener("click", () => {
  celsius = !celsius;               // inverte true/false
  btnUnidade.textContent = celsius ? "Mostrar em °F" : "Mostrar em °C";
  if (dados) mostrar();
});
