// 1. Pegando os elementos do HTML
const form = document.getElementById("form");
const inputCidade = document.getElementById("cidade");
const btnUnidade = document.getElementById("unidade");
const btnLocalizacao = document.getElementById("localizacao");
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

// 4. Passo 1: nome da cidade → coordenadas
async function buscarCoordenadas(cidade) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt`;
  const resp = await fetch(url);
  const geo = await resp.json();

  if (!geo.results) throw new Error("Cidade não encontrada.");
  const { latitude, longitude, name, country } = geo.results[0];

  return { latitude, longitude, nome: `${name}, ${country}` };
}

// 5. Passo 2: coordenadas → clima
async function buscarClimaPorCoordenadas(latitude, longitude, nomeLocal) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Erro ao buscar o clima.");
  const clima = await resp.json();

  return { cidade: nomeLocal, atual: clima.current };
}

// 6. Mostra os dados na tela
function mostrar() {
  const c = dados.atual.temperature_2m;
  const valor = celsius ? c : (c * 9) / 5 + 32; // fórmula °C → °F

  nome.textContent = dados.cidade;
  temp.textContent = `${valor.toFixed(1)}°${celsius ? "C" : "F"}`;
  descricao.textContent = traduzCodigo(dados.atual.weather_code);
  detalhes.textContent = `💧 ${dados.atual.relative_humidity_2m}%  |  💨 ${dados.atual.wind_speed_10m} km/h`;
  resultado.hidden = false;
}

// 7. Evento: busca por nome da cidade
form.addEventListener("submit", async (e) => {
  e.preventDefault();               // impede a página de recarregar
  mensagem.textContent = "Buscando...";
  try {
    const local = await buscarCoordenadas(inputCidade.value.trim());
    dados = await buscarClimaPorCoordenadas(local.latitude, local.longitude, local.nome);
    mensagem.textContent = "";
    mostrar();
  } catch (erro) {
    resultado.hidden = true;
    mensagem.textContent = erro.message; // mostra o erro ao usuário
  }
});

// 8. Evento: troca entre °C e °F
btnUnidade.addEventListener("click", () => {
  celsius = !celsius;               // inverte true/false
  btnUnidade.textContent = celsius ? "Mostrar em °F" : "Mostrar em °C";
  if (dados) mostrar();
});

// 9. Evento: usar a localização do usuário
btnLocalizacao.addEventListener("click", () => {
  // Verifica se o navegador suporta geolocalização
  if (!navigator.geolocation) {
    mensagem.textContent = "Seu navegador não suporta geolocalização.";
    return;
  }

  mensagem.textContent = "Obtendo sua localização...";

  navigator.geolocation.getCurrentPosition(
    // Callback de sucesso: o usuário permitiu
    async (posicao) => {
      try {
        const { latitude, longitude } = posicao.coords;
        dados = await buscarClimaPorCoordenadas(latitude, longitude, "📍 Sua localização");
        mensagem.textContent = "";
        mostrar();
      } catch (erro) {
        resultado.hidden = true;
        mensagem.textContent = erro.message;
      }
    },
    // Callback de erro: negou a permissão, GPS indisponível etc.
    (erro) => {
      resultado.hidden = true;
      mensagem.textContent =
        erro.code === erro.PERMISSION_DENIED
          ? "Permissão de localização negada."
          : "Não foi possível obter sua localização.";
    }
  );
});
