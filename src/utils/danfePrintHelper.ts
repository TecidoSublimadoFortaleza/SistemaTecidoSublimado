import { NotaFiscal } from '../services/api';

/**
 * Utilitário de Geração e Impressão de DANFE em Tela Cheia / Nova Aba
 * Suporta NF-e (Modelo 55) e NFC-e (Cupom Fiscal do Consumidor)
 */

// Gera código de barras Code-128 SEFAZ em SVG
function generateBarcodeSvg(code: string): string {
  const digits = (code || '23260936047818000107550030000061771120519837').replace(/\D/g, '');
  const bars: { width: number; isBlack: boolean }[] = [];
  bars.push({ width: 2, isBlack: true }, { width: 1, isBlack: false }, { width: 1, isBlack: true });
  for (let i = 0; i < digits.length; i++) {
    const val = parseInt(digits[i], 10) || 1;
    const w1 = (val % 3) + 1;
    const w2 = ((val * 2) % 2) + 1;
    const w3 = ((val * 3) % 3) + 1;
    bars.push({ width: w1, isBlack: true });
    bars.push({ width: 1, isBlack: false });
    bars.push({ width: w2, isBlack: true });
    bars.push({ width: w3, isBlack: false });
  }
  bars.push({ width: 2, isBlack: true }, { width: 1, isBlack: false }, { width: 3, isBlack: true });

  let currentX = 2;
  const rects = bars
    .map((b) => {
      const x = currentX;
      currentX += b.width * 1.65;
      if (!b.isBlack) return '';
      return `<rect x="${x}" y="1" width="${b.width * 1.6}" height="34" fill="#000000" />`;
    })
    .join('');

  const totalWidth = Math.max(340, Math.ceil(currentX + 4));
  return `<svg viewBox="0 0 ${totalWidth} 36" style="width: 100%; height: 38px; display: block;" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

// Formata número com 9 dígitos (ex: 000.006.177)
function formatNumero(num?: number | string): string {
  if (!num) return '000.000.001';
  const clean = String(num).replace(/\D/g, '');
  const padded = clean.padStart(9, '0');
  return `${padded.slice(0, 3)}.${padded.slice(3, 6)}.${padded.slice(6, 9)}`;
}

function formatBRL(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return '0,00';
  return Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d?: string): string {
  if (!d) return new Date().toLocaleDateString('pt-BR');
  try {
    return new Date(d).toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
}

function formatDateTime(d?: string): string {
  if (!d) return `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`;
  try {
    const dt = new Date(d);
    return `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR')}`;
  } catch {
    return d;
  }
}

function formatChave(chave?: string): string {
  if (!chave) return '2326 0936 0478 1800 0107 5500 3000 0061 7711 2051 9837';
  const clean = chave.replace(/\D/g, '');
  return clean.replace(/(\d{4})/g, '$1 ').trim();
}

function escapeHtml(str?: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateDanfeHtml(nota: NotaFiscal): string {
  const isNfce = nota.tipo === 'NFCE';
  const formattedChave = formatChave(nota.chaveAcesso);
  const cleanChave = (nota.chaveAcesso || '').replace(/\D/g, '');
  const barcodeSvg = generateBarcodeSvg(nota.chaveAcesso);
  const logoUrl = 'https://raw.githubusercontent.com/MarceloGomes-Dev/WWW.TECIDOSUBLIMADOFORTALEZA/main/public/images/logo-ts.png';

  // Fallback XML se não houver no objeto
  const xmlContent =
    nota.xmlConteudo ||
    `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe${cleanChave || '23260936047818000107550030000061771120519837'}" versao="4.00">
      <ide>
        <cUF>23</cUF>
        <cNF>11205198</cNF>
        <natOp>${escapeHtml(nota.naturezaOperacao || 'VENDA DE MERCADORIA')}</natOp>
        <mod>${isNfce ? '65' : '55'}</mod>
        <serie>${nota.serie || '6'}</serie>
        <nNF>${nota.numero}</nNF>
        <dhEmi>${nota.dataEmissao || new Date().toISOString()}</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>2304400</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>7</cDV>
        <tpAmb>${nota.ambiente === 'PRODUCAO' ? '1' : '2'}</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>1</indPres>
        <procEmi>0</procEmi>
        <verProc>SubliGestao 4.0</verProc>
      </ide>
      <emit>
        <CNPJ>${(nota.emitente.cnpj || '36047818000107').replace(/\D/g, '')}</CNPJ>
        <xNome>${escapeHtml(nota.emitente.razaoSocial || 'TECIDO SUBLIMADO FORTALEZA COMERCIO E SERVICOS LTDA')}</xNome>
        <xFant>${escapeHtml(nota.emitente.nomeFantasia || 'TECIDO SUBLIMADO')}</xFant>
        <IE>${(nota.emitente.inscricaoEstadual || '061671967').replace(/\D/g, '')}</IE>
        <CRT>1</CRT>
      </emit>
      <dest>
        <CPF>${(nota.clienteDocumento || '00000000000').replace(/\D/g, '')}</CPF>
        <xNome>${escapeHtml(nota.clienteNome || 'CONSUMIDOR FINAL')}</xNome>
        <indIEDest>9</indIEDest>
      </dest>
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vProd>${(nota.valorProdutos || nota.valorTotal || 0).toFixed(2)}</vProd>
          <vFrete>${(nota.valorFrete || 0).toFixed(2)}</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>${(nota.valorDesconto || 0).toFixed(2)}</vDesc>
          <vNF>${(nota.valorTotal || 0).toFixed(2)}</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>${nota.ambiente === 'PRODUCAO' ? '1' : '2'}</tpAmb>
      <verAplic>CE_NFE_V4.00</verAplic>
      <chNFe>${cleanChave || '23260936047818000107550030000061771120519837'}</chNFe>
      <dhRecbto>${nota.dataAutorizacao || nota.dataEmissao || new Date().toISOString()}</dhRecbto>
      <nProt>${nota.protocolo || '223260099625374'}</nProt>
      <digVal>SDE445DFG6789==</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

  const itensHtml = nota.itens
    .map(
      (it, idx) => `
    <tr>
      <td style="padding: 2px 4px; border-right: 1px solid #000; font-weight: bold;">${escapeHtml(it.codigo || `PRD-${idx + 1}`)}</td>
      <td style="padding: 2px 4px; border-right: 1px solid #000; font-family: sans-serif; font-size: 8px;">${escapeHtml(it.descricao)}</td>
      <td style="padding: 2px 4px; border-right: 1px solid #000; text-align: center;">${escapeHtml(it.ncm || '6109.10.00')}</td>
      <td style="padding: 2px 4px; border-right: 1px solid #000; text-align: center;">${escapeHtml(it.csosn || '102')}</td>
      <td style="padding: 2px 4px; border-right: 1px solid #000; text-align: center;">${escapeHtml(it.cfop || '5102')}</td>
      <td style="padding: 2px 4px; border-right: 1px solid #000; text-align: center; font-weight: bold;">${escapeHtml(it.unidade || 'UN')}</td>
      <td style="padding: 2px 4px; border-right: 1px solid #000; text-align: right;">${Number(it.quantidade || 1).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td style="padding: 2px 4px; border-right: 1px solid #000; text-align: right;">${formatBRL(it.valorUnitario)}</td>
      <td style="padding: 2px 4px; border-right: 1px solid #000; text-align: right; font-weight: bold;">${formatBRL(it.valorTotal)}</td>
      <td style="padding: 2px 4px; border-right: 1px solid #000; text-align: right;">0,00</td>
      <td style="padding: 2px 4px; border-right: 1px solid #000; text-align: right;">0,00</td>
      <td style="padding: 2px 4px; border-right: 1px solid #000; text-align: right;">0,00</td>
      <td style="padding: 2px 4px; border-right: 1px solid #000; text-align: right;">0,00</td>
      <td style="padding: 2px 4px; text-align: right;">0,00</td>
    </tr>`
    )
    .join('');

  const qtdTotalItens = nota.itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DANFE_${nota.tipo}_${nota.numero}_Serie_${nota.serie}_${cleanChave || 'SEFAZ'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page {
      size: ${isNfce ? '80mm auto' : 'A4 portrait'};
      margin: ${isNfce ? '3mm' : '4mm'};
    }
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      #danfe-page-container {
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
        min-height: auto !important;
      }
      #danfe-sheet {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
      }
    }
    body {
      background-color: #f1f5f9;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    * {
      box-sizing: border-box;
    }
    .top-action-bar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      border-bottom: 1px solid #1e293b;
    }
    .btn-action {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 700;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      text-decoration: none;
      white-space: nowrap;
    }
    .btn-print {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-print:hover {
      background: #1d4ed8;
      transform: translateY(-1px);
    }
    .btn-xml {
      background: #334155;
      color: #f8fafc;
      border: 1px solid #475569;
    }
    .btn-xml:hover {
      background: #475569;
      color: #ffffff;
    }
    .btn-wpp {
      background: #16a34a;
      color: #ffffff;
    }
    .btn-wpp:hover {
      background: #15803d;
      transform: translateY(-1px);
    }
    .btn-close {
      background: #e2e8f0;
      color: #0f172a;
    }
    .btn-close:hover {
      background: #cbd5e1;
    }
    .danfe-box {
      border: 1px solid #000000;
    }
    .danfe-border-b {
      border-bottom: 1px solid #000000;
    }
    .danfe-border-r {
      border-right: 1px solid #000000;
    }
    .danfe-header-title {
      background-color: #f8fafc;
      font-size: 7.5px;
      font-weight: 900;
      text-transform: uppercase;
      padding: 2px 4px;
      border: 1px solid #000000;
      border-bottom: none;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <!-- XML Hidden Store -->
  <textarea id="xml-data-holder" style="display: none;">${xmlContent}</textarea>

  <!-- TOP ACTION BAR COM OS BOTÕES SOLICITADOS -->
  <header class="no-print top-action-bar">
    <div style="display: flex; align-items: center; gap: 14px; min-width: 0;">
      <div style="background: #2563eb; padding: 6px 10px; border-radius: 8px; font-weight: 900; font-size: 13px; letter-spacing: 0.5px;">
        ${isNfce ? 'NFC-e (CUPOM FISCAL)' : 'DANFE NF-e (MODELO 55)'}
      </div>
      <div style="min-width: 0;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-weight: 800; font-size: 15px;">Nº ${nota.numero} • Série ${nota.serie}</span>
          <span style="background: #10b981; color: #ffffff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 6px; text-transform: uppercase;">
            ${escapeHtml(nota.status || 'AUTORIZADA')}
          </span>
          <span style="font-size: 12px; color: #94a3b8;">TECIDO SUBLIMADO</span>
        </div>
        <div style="font-size: 11px; color: #94a3b8; font-family: monospace; margin-top: 2px; display: flex; align-items: center; gap: 8px;">
          <span>Chave: ${formattedChave}</span>
          <button onclick="copiarChave()" style="background: transparent; border: none; color: #38bdf8; cursor: pointer; font-size: 11px; text-decoration: underline; padding: 0;">
            Copiar Chave
          </button>
        </div>
      </div>
    </div>

    <!-- BOTÕES SOLICITADOS: IMPRIMIR/PDF, FECHAR, BAIXAR XML, WHATSAPP -->
    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
      <button onclick="window.print()" class="btn-action btn-print" title="Imprimir na Impressora ou Salvar como PDF">
        <span>🖨️</span>
        <span>Imprimir / Salvar como PDF</span>
      </button>

      <button onclick="baixarXml()" class="btn-action btn-xml" title="Fazer Download do Arquivo XML da Nota">
        <span>📥</span>
        <span>BAIXAR XML</span>
      </button>

      <button onclick="enviarWhatsApp()" class="btn-action btn-wpp" title="Enviar comprovante e chave por WhatsApp">
        <span>💬</span>
        <span>WHATSAPP</span>
      </button>

      <button onclick="fecharJanela()" class="btn-action btn-close" title="Fechar visualização">
        <span>✕</span>
        <span>Fechar</span>
      </button>
    </div>
  </header>

  <!-- DANFE SHEET CONTAINER FULLSCREEN -->
  <main id="danfe-page-container" style="padding: 24px 16px; min-height: calc(100vh - 65px);">
    <div id="danfe-sheet" style="max-width: 860px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      
      ${
        nota.status === 'CANCELADA'
          ? `
        <div style="margin-bottom: 12px; padding: 10px; background: #fff1f2; border: 2px dashed #f43f5e; border-radius: 8px; text-align: center;">
          <div style="color: #be123c; font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
            ⚠️ NOTA FISCAL CANCELADA NA SEFAZ
          </div>
          <div style="color: #e11d48; font-size: 11px; margin-top: 2px;">
            Motivo: ${escapeHtml(nota.motivoCancelamento || 'Cancelamento solicitado pela empresa')} • Protocolo: ${escapeHtml(nota.protocoloCancelamento || '-')}
          </div>
        </div>
      `
          : ''
      }

      ${
        isNfce
          ? `
        <!-- ==================== NFC-E (CUPOM FISCAL 80MM) ==================== -->
        <div style="max-width: 380px; margin: 0 auto; font-family: monospace; font-size: 11px; border: 1px solid #cbd5e1; padding: 14px; border-radius: 8px; background: #fff;">
          <div style="text-align: center; border-bottom: 1px dashed #94a3b8; padding-bottom: 10px; margin-bottom: 10px;">
            <div style="font-weight: bold; font-size: 13px;">${escapeHtml(nota.emitente.razaoSocial || 'TECIDO SUBLIMADO FORTALEZA LTDA')}</div>
            <div style="font-size: 11px;">${escapeHtml(nota.emitente.nomeFantasia || 'TECIDO SUBLIMADO')}</div>
            <div style="font-size: 10px; color: #475569; margin-top: 2px;">
              CNPJ: ${escapeHtml(nota.emitente.cnpj || '36.047.818/0001-07')} • IE: ${escapeHtml(nota.emitente.inscricaoEstadual || '061671967')}
            </div>
            <div style="font-size: 10px; color: #475569;">${escapeHtml(nota.emitente.endereco || 'Av. Senador Fernandes Távora, 2305')} - ${escapeHtml(nota.emitente.cidade || 'Fortaleza')}/${escapeHtml(nota.emitente.uf || 'CE')}</div>
            <div style="margin-top: 6px; padding: 4px; background: #f1f5f9; font-weight: bold; font-size: 10px; border: 1px solid #cbd5e1;">
              DANFE NFC-e - Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
            </div>
            <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Não permite aproveitamento de crédito de ICMS</div>
          </div>

          <div style="border-bottom: 1px dashed #94a3b8; padding-bottom: 8px; margin-bottom: 8px;">
            <div style="display: flex; font-weight: bold; font-size: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 4px;">
              <div style="flex: 2;">ITEM / DESCRIÇÃO</div>
              <div style="width: 45px; text-align: center;">QTD</div>
              <div style="width: 60px; text-align: right;">VL UN</div>
              <div style="width: 65px; text-align: right;">TOTAL</div>
            </div>
            ${nota.itens
              .map(
                (it) => `
              <div style="display: flex; font-size: 10px; padding: 2px 0;">
                <div style="flex: 2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(it.descricao)}</div>
                <div style="width: 45px; text-align: center;">${it.quantidade}</div>
                <div style="width: 60px; text-align: right;">R$ ${Number(it.valorUnitario).toFixed(2)}</div>
                <div style="width: 65px; text-align: right; font-weight: bold;">R$ ${Number(it.valorTotal).toFixed(2)}</div>
              </div>`
              )
              .join('')}
          </div>

          <div style="border-bottom: 1px dashed #94a3b8; padding-bottom: 8px; margin-bottom: 8px; font-size: 11px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Qtd. Total de Itens:</span>
              <span style="font-weight: bold;">${nota.itens.length}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Valor dos Produtos:</span>
              <span>R$ ${formatBRL(nota.valorProdutos || nota.valorTotal)}</span>
            </div>
            ${
              nota.valorDesconto
                ? `
            <div style="display: flex; justify-content: space-between; color: #16a34a;">
              <span>Desconto:</span>
              <span>- R$ ${formatBRL(nota.valorDesconto)}</span>
            </div>`
                : ''
            }
            <div style="display: flex; justify-content: space-between; font-weight: 900; font-size: 13px; border-top: 1px solid #cbd5e1; padding-top: 4px; margin-top: 4px;">
              <span>VALOR TOTAL A PAGAR:</span>
              <span>R$ ${formatBRL(nota.valorTotal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #475569; margin-top: 4px;">
              <span>FORMA DE PAGAMENTO:</span>
              <span style="font-weight: bold;">${escapeHtml(nota.formaPagamento || 'A VISTA')}</span>
            </div>
          </div>

          <div style="border-bottom: 1px dashed #94a3b8; padding-bottom: 8px; margin-bottom: 8px; font-size: 10px;">
            <div style="font-weight: bold;">CONSUMIDOR:</div>
            <div>${escapeHtml(nota.clienteNome || 'Consumidor Final Não Identificado')}</div>
            ${nota.clienteDocumento ? `<div>CPF/CNPJ: ${escapeHtml(nota.clienteDocumento)}</div>` : ''}
          </div>

          <div style="text-align: center; padding-top: 4px;">
            <div style="background: #ffffff; border: 1px solid #e2e8f0; display: inline-block; padding: 8px; border-radius: 6px;">
              <svg viewBox="0 0 100 100" style="width: 110px; height: 110px; display: block;">
                <!-- QR Code Pattern -->
                <rect width="100" height="100" fill="#ffffff" />
                <rect x="10" y="10" width="30" height="30" fill="#000000" />
                <rect x="15" y="15" width="20" height="20" fill="#ffffff" />
                <rect x="20" y="20" width="10" height="10" fill="#000000" />
                <rect x="60" y="10" width="30" height="30" fill="#000000" />
                <rect x="65" y="15" width="20" height="20" fill="#ffffff" />
                <rect x="70" y="20" width="10" height="10" fill="#000000" />
                <rect x="10" y="60" width="30" height="30" fill="#000000" />
                <rect x="15" y="65" width="20" height="20" fill="#ffffff" />
                <rect x="20" y="70" width="10" height="10" fill="#000000" />
                <rect x="50" y="50" width="15" height="15" fill="#000000" />
                <rect x="70" y="65" width="20" height="10" fill="#000000" />
                <rect x="65" y="80" width="10" height="10" fill="#000000" />
              </svg>
            </div>
            <div style="font-size: 9px; color: #475569; margin-top: 6px; font-weight: bold;">Consulte pela Chave de Acesso em:</div>
            <div style="font-size: 8.5px; color: #2563eb; word-break: break-all;">http://nfce.sefaz.ce.gov.br/consulta</div>
            <div style="font-size: 9px; font-family: monospace; font-weight: bold; background: #f1f5f9; padding: 4px; border-radius: 4px; margin-top: 4px;">
              ${formattedChave}
            </div>
            <div style="font-size: 8.5px; color: #64748b; margin-top: 6px;">
              <div>Nº: ${nota.numero} • Série: ${nota.serie} • Emissão: ${formatDateTime(nota.dataEmissao)}</div>
              <div>Protocolo de Autorização: ${escapeHtml(nota.protocolo || '223260099625374')}</div>
              <div style="font-weight: bold; color: #334155; margin-top: 2px;">
                ${nota.ambiente === 'PRODUCAO' ? 'EMITIDA EM AMBIENTE DE PRODUÇÃO' : 'AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL'}
              </div>
            </div>
          </div>
        </div>
      `
          : `
        <!-- ==================== NF-E MODELO 55 (OFICIAL SEFAZ BRASIL) ==================== -->
        <div style="font-size: 8.5px; line-height: 1.25; color: #000000; font-family: Arial, sans-serif;">
          
          <!-- 0. CANHOTO DE RECEBIMENTO -->
          <div class="danfe-box" style="margin-bottom: 6px; font-size: 8px;">
            <div style="display: flex; border-bottom: 1px solid #000;">
              <div style="flex: 10; padding: 6px; font-weight: bold; text-transform: uppercase;">
                RECEBEMOS DE ${escapeHtml(nota.emitente.razaoSocial || 'TECIDO SUBLIMADO FORTALEZA COMERCIO E SERVICOS LTDA')} OS PRODUTOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO
              </div>
              <div style="flex: 2; border-left: 1px solid #000; padding: 4px; text-align: center; font-weight: bold;">
                <div style="font-size: 10px;">NF-e</div>
                <div>Nº ${formatNumero(nota.numero)}</div>
                <div>Série ${nota.serie}</div>
              </div>
            </div>
            <div style="display: flex;">
              <div style="flex: 3; border-right: 1px solid #000; padding: 4px;">
                <span style="font-size: 7px; display: block; font-weight: bold; color: #475569;">DATA DE RECEBIMENTO</span>
                <div style="height: 14px;"></div>
              </div>
              <div style="flex: 6; border-right: 1px solid #000; padding: 4px;">
                <span style="font-size: 7px; display: block; font-weight: bold; color: #475569;">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</span>
                <div style="height: 14px;"></div>
              </div>
              <div style="flex: 3; padding: 4px; font-size: 7.5px;">
                <div><strong>DESTINATÁRIO:</strong> ${escapeHtml(nota.clienteNome)}</div>
                <div><strong>VLR TOTAL:</strong> R$ ${formatBRL(nota.valorTotal)}</div>
                <div><strong>EMISSÃO:</strong> ${formatDate(nota.dataEmissao)}</div>
              </div>
            </div>
          </div>

          <div style="border-bottom: 1px dashed #94a3b8; margin: 6px 0; text-align: center; position: relative;">
            <span style="background: #fff; padding: 0 8px; font-size: 7px; color: #94a3b8; text-transform: uppercase; font-family: monospace;">
              - - - - - - - - - - - - - - Destaque Aqui - - - - - - - - - - - - - -
            </span>
          </div>

          <!-- 1. IDENTIFICAÇÃO DO EMITENTE & DANFE HEADER -->
          <div class="danfe-box" style="margin-bottom: 6px;">
            <div style="display: flex; border-bottom: 1px solid #000;">
              
              <!-- Emitente -->
              <div style="flex: 5; padding: 8px 10px; border-right: 1px solid #000; display: flex; gap: 12px; align-items: center;">
                <div style="width: 82px; height: 82px; min-width: 82px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px; background: #ffffff;">
                  <img src="${logoUrl}" alt="Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.style.display='none'" />
                </div>
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                  <div style="font-size: 8px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px;">IDENTIFICAÇÃO DO EMITENTE</div>
                  <div style="font-weight: 900; font-size: 13px; text-transform: uppercase; line-height: 1.2; color: #000000; margin-bottom: 4px; letter-spacing: 0.2px;">
                    ${escapeHtml(nota.emitente.razaoSocial || 'TECIDO SUBLIMADO FORTALEZA COMERCIO E SERVICOS LTDA')}
                  </div>
                  <div style="font-size: 9.5px; line-height: 1.35; color: #1e293b; font-weight: 600;">
                    <div>${escapeHtml(nota.emitente.endereco || 'AVENIDA SENADOR FERNANDES TÁVORA, 2305')}</div>
                    <div>${escapeHtml(nota.emitente.cidade || 'FORTALEZA')} - ${escapeHtml(nota.emitente.uf || 'CE')}${nota.emitente.telefone ? ` • FONE: ${escapeHtml(nota.emitente.telefone)}` : ''}</div>
                    <div style="font-size: 9px; color: #334155; margin-top: 1px;">CNPJ: ${escapeHtml(nota.emitente.cnpj || '36.047.818/0001-07')} • IE: ${escapeHtml(nota.emitente.inscricaoEstadual || '061671967')}</div>
                  </div>
                </div>
              </div>

              <!-- DANFE Header -->
              <div style="flex: 3; padding: 6px; border-right: 1px solid #000; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="font-weight: 900; font-size: 17px; letter-spacing: 1px;">DANFE</div>
                  <div style="font-size: 7.5px; font-weight: bold; text-transform: uppercase;">Documento Auxiliar da Nota Fiscal Eletrônica</div>
                  <div style="margin-top: 4px; font-size: 8px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px;">
                    <span>0 - ENTRADA</span>
                    <span style="display: inline-flex; align-items: center; gap: 3px;">
                      <span>1 - SAÍDA</span>
                      <span style="width: 15px; height: 15px; border: 1px solid #000; display: inline-flex; align-items: center; justify-content: center; font-weight: 900;">1</span>
                    </span>
                  </div>
                </div>
                <div style="border-top: 1px solid #cbd5e1; padding-top: 3px; font-family: monospace;">
                  <div style="font-weight: 900; font-size: 11px;">Nº ${formatNumero(nota.numero)}</div>
                  <div style="font-weight: bold; font-size: 8.5px;">SÉRIE ${nota.serie}</div>
                  <div style="font-size: 7.5px; color: #475569;">FL 1 / 1</div>
                </div>
              </div>

              <!-- Barcode & Chave -->
              <div style="flex: 4; padding: 6px; display: flex; flex-direction: column; justify-content: space-between;">
                <div style="text-align: center;">
                  ${barcodeSvg}
                  <div style="margin-top: 3px;">
                    <span style="font-size: 7px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">CHAVE DE ACESSO</span>
                    <span style="font-family: monospace; font-size: 8px; font-weight: 900; letter-spacing: 0.5px; display: block;">
                      ${formattedChave}
                    </span>
                  </div>
                </div>
                <div style="font-size: 6.5px; color: #475569; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 3px;">
                  Consulta de autenticidade no portal nacional da NF-e<br />
                  <strong>www.nfe.fazenda.gov.br/portal</strong> ou no site da Sefaz Autorizadora
                </div>
              </div>
            </div>

            <!-- Natureza da Operação e Protocolo -->
            <div style="display: flex; border-bottom: 1px solid #000; font-size: 8px;">
              <div style="flex: 7; padding: 4px; border-right: 1px solid #000;">
                <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">NATUREZA DA OPERAÇÃO</span>
                <span style="font-weight: bold;">${escapeHtml(nota.naturezaOperacao || 'Venda de producao do estabelecimento')}</span>
              </div>
              <div style="flex: 5; padding: 4px;">
                <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">PROTOCOLO DE AUTORIZAÇÃO DE USO</span>
                <span style="font-family: monospace; font-weight: bold;">${escapeHtml(nota.protocolo || '223260099625374')} ${formatDateTime(nota.dataAutorizacao || nota.dataEmissao)}</span>
              </div>
            </div>

            <!-- IE e CNPJ Emitente -->
            <div style="display: flex; font-size: 8px;">
              <div style="flex: 4; padding: 4px; border-right: 1px solid #000;">
                <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">INSCRIÇÃO ESTADUAL</span>
                <span style="font-family: monospace; font-weight: bold;">${escapeHtml(nota.emitente.inscricaoEstadual || '061671967')}</span>
              </div>
              <div style="flex: 4; padding: 4px; border-right: 1px solid #000;">
                <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">INSC. ESTADUAL DO SUBST. TRIBUTÁRIO</span>
                <span style="font-family: monospace;">-</span>
              </div>
              <div style="flex: 4; padding: 4px;">
                <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">CNPJ / CPF</span>
                <span style="font-family: monospace; font-weight: bold;">${escapeHtml(nota.emitente.cnpj || '36.047.818/0001-07')}</span>
              </div>
            </div>
          </div>

          <!-- 2. DESTINATÁRIO / REMETENTE -->
          <div style="margin-bottom: 6px;">
            <div class="danfe-header-title">DESTINATÁRIO / REMETENTE</div>
            <div class="danfe-box" style="font-size: 8px;">
              <div style="display: flex; border-bottom: 1px solid #000;">
                <div style="flex: 7; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">NOME / RAZÃO SOCIAL</span>
                  <span style="font-weight: bold;">${escapeHtml(nota.clienteNome)}${nota.clienteNomeFantasia && nota.clienteNomeFantasia !== nota.clienteNome ? ` (${escapeHtml(nota.clienteNomeFantasia)})` : ''}</span>
                </div>
                <div style="flex: 3; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">CNPJ / CPF</span>
                  <span style="font-family: monospace; font-weight: bold;">${escapeHtml(nota.clienteDocumento || 'Consumidor Final')}</span>
                </div>
                <div style="flex: 2; padding: 4px;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">DATA DA EMISSÃO</span>
                  <span style="font-family: monospace; font-weight: bold;">${formatDate(nota.dataEmissao)}</span>
                </div>
              </div>

              <div style="display: flex; border-bottom: 1px solid #000;">
                <div style="flex: 5; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">ENDEREÇO</span>
                  <span>${escapeHtml(nota.clienteEndereco ? (typeof nota.clienteEndereco === 'string' ? nota.clienteEndereco : `${nota.clienteEndereco.logradouro || ''}${nota.clienteEndereco.numero ? `, ${nota.clienteEndereco.numero}` : ''}${nota.clienteEndereco.complemento ? ` - ${nota.clienteEndereco.complemento}` : ''}`) : '')}</span>
                </div>
                <div style="flex: 3; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">BAIRRO / DISTRITO</span>
                  <span>${escapeHtml(typeof nota.clienteEndereco === 'object' ? (nota.clienteEndereco?.bairro || '') : '')}</span>
                </div>
                <div style="flex: 2; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">CEP</span>
                  <span style="font-family: monospace;">${escapeHtml(typeof nota.clienteEndereco === 'object' ? (nota.clienteEndereco?.cep || '') : '')}</span>
                </div>
                <div style="flex: 2; padding: 4px;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">DATA SAÍDA/ENTRADA</span>
                  <span style="font-family: monospace;">${formatDate(nota.dataEmissao)}</span>
                </div>
              </div>

              <div style="display: flex;">
                <div style="flex: 5; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">MUNICÍPIO</span>
                  <span>${escapeHtml(typeof nota.clienteEndereco === 'object' ? (nota.clienteEndereco?.cidade || 'FORTALEZA') : 'FORTALEZA')}</span>
                </div>
                <div style="flex: 3; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">FONE / FAX</span>
                  <span style="font-family: monospace;">${escapeHtml(nota.clienteTelefone || '')}</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000; text-align: center;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">UF</span>
                  <span style="font-weight: bold;">${escapeHtml(typeof nota.clienteEndereco === 'object' ? (nota.clienteEndereco?.uf || 'CE') : 'CE')}</span>
                </div>
                <div style="flex: 3; padding: 4px;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">INSCRIÇÃO ESTADUAL</span>
                  <span style="font-family: monospace;">${escapeHtml(nota.clienteInscricaoEstadual || '')}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. CÁLCULO DO IMPOSTO -->
          <div style="margin-bottom: 6px;">
            <div class="danfe-header-title">CÁLCULO DO IMPOSTO</div>
            <div class="danfe-box" style="font-size: 8px;">
              <div style="display: flex; border-bottom: 1px solid #000;">
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">BASE CÁLC. DO ICMS</span>
                  <span style="font-family: monospace; display: block; text-align: right;">0,00</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">VALOR DO ICMS</span>
                  <span style="font-family: monospace; display: block; text-align: right;">0,00</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">BASE CÁLC. ICMS ST</span>
                  <span style="font-family: monospace; display: block; text-align: right;">0,00</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">VALOR DO ICMS ST</span>
                  <span style="font-family: monospace; display: block; text-align: right;">0,00</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">V. IMP. IMPORTAÇÃO</span>
                  <span style="font-family: monospace; display: block; text-align: right;">0,00</span>
                </div>
                <div style="flex: 1; padding: 4px;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">V. TOTAL PRODUTOS</span>
                  <span style="font-family: monospace; display: block; text-align: right; font-weight: bold;">R$ ${formatBRL(nota.valorProdutos || nota.valorTotal)}</span>
                </div>
              </div>

              <div style="display: flex;">
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">VALOR DO FRETE</span>
                  <span style="font-family: monospace; display: block; text-align: right;">R$ ${formatBRL(nota.valorFrete || 0)}</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">VALOR DO SEGURO</span>
                  <span style="font-family: monospace; display: block; text-align: right;">0,00</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">DESCONTO</span>
                  <span style="font-family: monospace; display: block; text-align: right;">R$ ${formatBRL(nota.valorDesconto || 0)}</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">OUTRAS DESPESAS</span>
                  <span style="font-family: monospace; display: block; text-align: right;">0,00</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">VALOR DO IPI</span>
                  <span style="font-family: monospace; display: block; text-align: right;">0,00</span>
                </div>
                <div style="flex: 1; padding: 4px; background: #f8fafc;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #334155; text-transform: uppercase; display: block;">V. TOTAL DA NOTA</span>
                  <span style="font-family: monospace; display: block; text-align: right; font-weight: 900; font-size: 9px;">R$ ${formatBRL(nota.valorTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. TRANSPORTADOR / VOLUMES TRANSPORTADOS -->
          <div style="margin-bottom: 6px;">
            <div class="danfe-header-title">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
            <div class="danfe-box" style="font-size: 8px;">
              <div style="display: flex; border-bottom: 1px solid #000;">
                <div style="flex: 5; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">RAZÃO SOCIAL</span>
                  <span style="font-weight: bold;">${escapeHtml(nota.transportadora?.razaoSocial || 'RETIRADA NO LOCAL')}</span>
                </div>
                <div style="flex: 3; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">FRETE POR CONTA</span>
                  <span style="font-weight: 600;">0-Contrat. por conta Remetente</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">CÓD. ANTT</span>
                  <span style="font-family: monospace;">-</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">PLACA</span>
                  <span style="font-family: monospace;">-</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000; text-align: center;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">UF</span>
                  <span>-</span>
                </div>
                <div style="flex: 1; padding: 4px;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">CNPJ / CPF</span>
                  <span style="font-family: monospace;">-</span>
                </div>
              </div>

              <div style="display: flex;">
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">QUANTIDADE</span>
                  <span style="font-family: monospace; display: block; text-align: right;">${qtdTotalItens}</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">ESPÉCIE</span>
                  <span>VOLUMES</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">MARCA</span>
                  <span>-</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">NUMERAÇÃO</span>
                  <span>-</span>
                </div>
                <div style="flex: 1; padding: 4px; border-right: 1px solid #000;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">PESO BRUTO</span>
                  <span style="font-family: monospace; display: block; text-align: right;">-</span>
                </div>
                <div style="flex: 1; padding: 4px;">
                  <span style="font-size: 6.5px; font-weight: bold; color: #475569; text-transform: uppercase; display: block;">PESO LÍQUIDO</span>
                  <span style="font-family: monospace; display: block; text-align: right;">-</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. DADOS DO PRODUTO / SERVIÇO -->
          <div style="margin-bottom: 6px;">
            <div class="danfe-header-title">DADOS DO PRODUTO / SERVIÇO</div>
            <div class="danfe-box">
              <table style="width: 100%; border-collapse: collapse; font-size: 7.5px; font-family: monospace;">
                <thead>
                  <tr style="background: #f8fafc; border-bottom: 1px solid #000; font-size: 6.5px; text-transform: uppercase; font-weight: bold; color: #334155;">
                    <th style="padding: 3px 4px; border-right: 1px solid #000; width: 65px; text-align: left;">CÓD. PROD.</th>
                    <th style="padding: 3px 4px; border-right: 1px solid #000; text-align: left; font-family: sans-serif;">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
                    <th style="padding: 3px 4px; border-right: 1px solid #000; width: 55px; text-align: center;">NCM/SH</th>
                    <th style="padding: 3px 4px; border-right: 1px solid #000; width: 40px; text-align: center;">CSOSN</th>
                    <th style="padding: 3px 4px; border-right: 1px solid #000; width: 40px; text-align: center;">CFOP</th>
                    <th style="padding: 3px 4px; border-right: 1px solid #000; width: 30px; text-align: center;">UN</th>
                    <th style="padding: 3px 4px; border-right: 1px solid #000; width: 45px; text-align: right;">QTD</th>
                    <th style="padding: 3px 4px; border-right: 1px solid #000; width: 55px; text-align: right;">V. UNIT.</th>
                    <th style="padding: 3px 4px; border-right: 1px solid #000; width: 60px; text-align: right;">V. TOTAL</th>
                    <th style="padding: 3px 4px; border-right: 1px solid #000; width: 45px; text-align: right;">BC ICMS</th>
                    <th style="padding: 3px 4px; border-right: 1px solid #000; width: 45px; text-align: right;">V. ICMS</th>
                    <th style="padding: 3px 4px; border-right: 1px solid #000; width: 40px; text-align: right;">V. IPI</th>
                    <th style="padding: 3px 4px; border-right: 1px solid #000; width: 40px; text-align: right;">ALÍQ. ICMS</th>
                    <th style="padding: 3px 4px; width: 40px; text-align: right;">ALÍQ. IPI</th>
                  </tr>
                </thead>
                <tbody>
                  ${itensHtml}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 6. DADOS ADICIONAIS -->
          <div>
            <div class="danfe-header-title">DADOS ADICIONAIS</div>
            <div class="danfe-box" style="display: flex; font-size: 7.5px; line-height: 1.4;">
              <div style="flex: 8; padding: 6px; border-right: 1px solid #000; color: #334155;">
                <div style="font-weight: bold; color: #000000; font-size: 8px;">INFORMAÇÕES COMPLEMENTARES:</div>
                <div style="margin-top: 2px;">
                  TRIB APROX 15,45% MUNICIPAL FONTE: IBPT PROCON 151 SCS QUADRA 8 EDIFICIO VENANCIO 2000 BLOCO B60 SALA 240 B 28,82.
                </div>
                <div style="margin-top: 2px;">
                  Documento emitido por ME ou EPP optante pelo Simples Nacional. Não gera direito a crédito fiscal de IPI e ICMS.
                  ${nota.origemCodigo ? ` Ref Pedido/OS: ${escapeHtml(nota.origemCodigo)}.` : ''}
                </div>
                <div style="margin-top: 4px; font-family: monospace; font-size: 7px; color: #64748b;">
                  Chave de Acesso: ${formattedChave} • Protocolo SEFAZ: ${escapeHtml(nota.protocolo || '223260099625374')}
                </div>
              </div>
              <div style="flex: 4; padding: 6px; display: flex; flex-direction: column; justify-content: space-between;">
                <span style="font-size: 7px; font-weight: bold; color: #475569; text-transform: uppercase;">RESERVADO AO FISCO</span>
                <div style="height: 35px;"></div>
              </div>
            </div>
          </div>

          <!-- 7. RODAPÉ DE IMPRESSÃO -->
          <div style="font-size: 7px; color: #64748b; text-align: right; margin-top: 4px;">
            DATA E HORA DA IMPRESSÃO: ${formatDateTime()}
          </div>
        </div>
      `
      }
    </div>
  </main>

  <!-- JAVASCRIPT EXCLUSIVO PARA AS 4 AÇÕES: IMPRIMIR/PDF, BAIXAR XML, WHATSAPP, FECHAR -->
  <script>
    var CHAVE_ACESSO = "${cleanChave}";
    var NUM_NF = "${nota.numero}";
    var SERIE_NF = "${nota.serie}";
    var CLIENTE_NOME = "${escapeHtml(nota.clienteNome || 'Cliente')}";
    var CLIENTE_FONE = "${escapeHtml(nota.clienteTelefone || '')}";
    var VALOR_TOTAL = "${formatBRL(nota.valorTotal)}";

    // 1. BAIXAR XML
    function baixarXml() {
      try {
        var holder = document.getElementById('xml-data-holder');
        var xml = holder ? holder.value : '';
        if (!xml) {
          alert('Conteúdo XML não localizado.');
          return;
        }
        var blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'NFe_' + (CHAVE_ACESSO || NUM_NF) + '.xml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
      } catch (err) {
        alert('Erro ao baixar XML: ' + (err.message || err));
      }
    }

    // 2. WHATSAPP
    function enviarWhatsApp() {
      var phone = CLIENTE_FONE.replace(/\\D/g, '');
      var msg = 'Olá, ' + CLIENTE_NOME + '! Segue os dados da sua Nota Fiscal Eletrônica Nº ' + NUM_NF + ' (Série ' + SERIE_NF + ') emitida por TECIDO SUBLIMADO:\\n\\n' +
        '🔑 Chave de Acesso: ' + CHAVE_ACESSO + '\\n' +
        '💰 Valor Total: R$ ' + VALOR_TOTAL + '\\n\\n' +
        'Você pode consultar a validade oficial no portal da SEFAZ: http://nfe.fazenda.gov.br/portal';
      var encoded = encodeURIComponent(msg);
      var url = phone
        ? ('https://api.whatsapp.com/send?phone=55' + phone + '&text=' + encoded)
        : ('https://api.whatsapp.com/send?text=' + encoded);
      window.open(url, '_blank');
    }

    // 3. FECHAR
    function fecharJanela() {
      window.close();
    }

    // COPIAR CHAVE
    function copiarChave() {
      if (!CHAVE_ACESSO) return;
      navigator.clipboard.writeText(CHAVE_ACESSO).then(function() {
        alert('Chave de Acesso copiada com sucesso:\\n' + CHAVE_ACESSO);
      }).catch(function() {
        prompt('Chave de Acesso da Nota:', CHAVE_ACESSO);
      });
    }

    // AUTO-FOCUS
    window.onload = function() {
      window.focus();
    };
  </script>
</body>
</html>`;
}

/**
 * Abre o DANFE em uma nova aba em tela cheia com todas as ações:
 * "🖨️ Imprimir / Salvar como PDF", "BAIXAR XML", "WHATSAPP", "Fechar"
 */
export function openDanfeInNewTab(nota: NotaFiscal): Window | null {
  if (!nota) return null;
  const html = generateDanfeHtml(nota);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  // Tenta abrir a nova aba diretamente
  const newWin = window.open(blobUrl, '_blank');

  if (!newWin) {
    // Fallback caso popup blocker do navegador interfira
    const a = document.createElement('a');
    a.href = blobUrl;
    a.target = '_blank';
    a.rel = 'noopener,noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return newWin;
}
