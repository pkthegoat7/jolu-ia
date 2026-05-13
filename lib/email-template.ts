import type { ResultadoAnalise } from './analise';
import type { ProtocoloPersonalizado, SlotProduto, SlotId } from './protocolo';

// Paleta navy da marca + acentos dourados pra contraste.
const C = {
  navyDeep: '#072C57',
  navyMid: '#0C417D',
  navyText: '#0C417D',
  cream: '#F2F5FA',
  creamLight: '#F4F7FB',
  gold: '#c9a575',
  goldSoft: '#d8c5a6',
  borderSoft: '#C4D2E4',
  textMuted: '#5A7299',
  white: '#ffffff',
};

const FONT_SERIF  = `'Playfair Display', Georgia, 'Times New Roman', serif`;
const FONT_SANS   = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif`;

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function slotMap(protocolo: ProtocoloPersonalizado): Record<SlotId, SlotProduto | undefined> {
  const m = {} as Record<SlotId, SlotProduto | undefined>;
  for (const s of protocolo.slots) m[s.slot.id] = s;
  return m;
}

function pageHeader(title: string, section: string): string {
  return `
    <tr><td style="padding:36px 48px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family:${FONT_SANS};font-size:10px;letter-spacing:0.32em;color:${C.navyDeep};text-transform:uppercase;font-weight:600;">PATRÍCIA ELIAS</td>
          <td align="right" style="font-family:${FONT_SANS};font-size:10px;letter-spacing:0.22em;color:${C.gold};text-transform:uppercase;font-weight:600;">${escapeHtml(section)}</td>
        </tr>
        <tr><td colspan="2" style="padding-top:8px;"><div style="height:1px;background:${C.borderSoft};"></div></td></tr>
      </table>
      <h2 style="margin:32px 0 4px;font-family:${FONT_SERIF};font-weight:400;font-size:34px;color:${C.navyDeep};line-height:1.15;">${escapeHtml(title)}</h2>
    </td></tr>
  `;
}

function pageFooter(): string {
  return `
    <tr><td style="padding:40px 48px 28px;">
      <div style="height:1px;background:${C.borderSoft};"></div>
      <p style="margin:18px 0 0;text-align:center;font-family:${FONT_SANS};font-size:9px;letter-spacing:0.22em;color:${C.textMuted};text-transform:uppercase;">
        Protocolo Personalizado · Linha Patrícia Elias<br>Dermocosméticos
      </p>
    </td></tr>
  `;
}

function precoLinha(s: SlotProduto): string {
  const { precoPromocional, precoNormal } = s.produto;
  if (precoPromocional && precoNormal && precoPromocional < precoNormal) {
    return `<span style="text-decoration:line-through;color:${C.textMuted};font-size:12px;">${fmtBRL(precoNormal)}</span> <strong style="color:${C.navyDeep};font-size:14px;">${fmtBRL(precoPromocional)}</strong>`;
  }
  const p = precoPromocional ?? precoNormal;
  return p ? `<strong style="color:${C.navyDeep};font-size:14px;">${fmtBRL(p)}</strong>` : '';
}

function passo(numero: number, s: SlotProduto): string {
  const nome = escapeHtml(s.produto.nome);
  const tag = escapeHtml(s.slot.rotulo);
  const comoUsar = escapeHtml(s.slot.comoUsar);
  const link = s.produto.link ? escapeHtml(s.produto.link) : '';
  const preco = precoLinha(s);

  return `
    <tr><td style="padding:0 48px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid ${C.gold};background:${C.creamLight};border-radius:0 8px 8px 0;">
        <tr>
          <td width="56" valign="top" style="padding:18px 0 18px 18px;">
            <p style="margin:0;font-family:${FONT_SERIF};font-size:22px;color:${C.gold};font-style:italic;">${String(numero).padStart(2,'0')}</p>
          </td>
          <td valign="top" style="padding:18px 22px 18px 0;">
            <p style="margin:0 0 6px;">
              <span style="font-family:${FONT_SERIF};font-size:17px;color:${C.navyDeep};font-weight:600;">${nome}</span>
              <span style="margin-left:10px;display:inline-block;padding:2px 8px;background:${C.cream};color:${C.navyMid};font-family:${FONT_SANS};font-size:9px;letter-spacing:0.14em;text-transform:uppercase;border-radius:3px;font-weight:600;">${tag}</span>
            </p>
            <p style="margin:0 0 10px;font-family:${FONT_SANS};font-size:13px;color:${C.navyText};line-height:1.65;">${comoUsar}</p>
            ${preco || link ? `
            <table cellpadding="0" cellspacing="0"><tr>
              ${preco ? `<td style="padding-right:14px;">${preco}</td>` : ''}
              ${link ? `<td><a href="${link}" style="display:inline-block;padding:6px 14px;background:${C.navyDeep};color:#fff;text-decoration:none;font-family:${FONT_SANS};font-size:11px;font-weight:600;letter-spacing:0.06em;border-radius:4px;">Ver produto →</a></td>` : ''}
            </tr></table>` : ''}
          </td>
        </tr>
      </table>
    </td></tr>
  `;
}

type DiagDetalhes = {
  nivelOleosidade: string;
  nivelAcne: string;
  nivelSensibilidade: string;
  observacoes: string;
};

function metricaPill(label: string, valor: string): string {
  return `
    <td valign="top" style="padding:0 4px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.borderSoft};border-radius:6px;background:${C.white};">
        <tr><td style="padding:12px 14px;text-align:center;">
          <p style="margin:0 0 4px;font-family:${FONT_SANS};font-size:9px;letter-spacing:0.2em;color:${C.gold};text-transform:uppercase;font-weight:600;">${escapeHtml(label)}</p>
          <p style="margin:0;font-family:${FONT_SERIF};font-size:15px;color:${C.navyDeep};line-height:1.2;">${escapeHtml(valor)}</p>
        </td></tr>
      </table>
    </td>
  `;
}

// 01 · Capa + Boas-vindas + Diagnóstico
function secaoBoasVindas(nome: string, queixa: string, foco: string, estrategia: string, tipoPele: string, det: DiagDetalhes): string {
  return `
    <!-- COVER STRIP -->
    <tr><td style="background:${C.navyDeep};padding:60px 48px 48px;text-align:center;">
      <p style="margin:0 0 14px;font-family:${FONT_SANS};font-size:10px;letter-spacing:0.5em;color:rgba(255,255,255,.55);text-transform:uppercase;">P A T R Í C I A &nbsp; E L I A S</p>
      <div style="display:inline-block;width:60px;height:1px;background:${C.gold};margin:0 0 24px;"></div>
      <p style="margin:0 0 6px;font-family:${FONT_SANS};font-size:11px;letter-spacing:0.3em;color:${C.goldSoft};text-transform:uppercase;">Protocolo Personalizado</p>
      <h1 style="margin:0 0 18px;font-family:${FONT_SERIF};font-weight:400;font-size:46px;color:#fff;line-height:1.1;letter-spacing:0.5px;">Skincare<br><em style="color:${C.goldSoft};">${escapeHtml(tipoPele)}</em></h1>
      <p style="margin:0 0 26px;font-family:${FONT_SERIF};font-style:italic;font-size:14px;color:rgba(255,255,255,.7);">Um ritual exclusivo para a sua pele</p>
      <div style="display:inline-block;width:40px;height:1px;background:rgba(255,255,255,.25);"></div>
      <p style="margin:18px 0 6px;font-family:${FONT_SANS};font-size:10px;letter-spacing:0.32em;color:rgba(255,255,255,.5);text-transform:uppercase;">Preparado para</p>
      <p style="margin:0;font-family:${FONT_SERIF};font-size:24px;color:#fff;font-weight:400;">${escapeHtml(nome)}</p>
    </td></tr>

    ${pageHeader(`Bem-vinda, ${nome}`, '01 · Boas-vindas')}

    <tr><td style="padding:18px 48px 0;">
      <p style="margin:0 0 22px;font-family:${FONT_SANS};font-size:13px;color:${C.textMuted};line-height:1.7;">Cuidar da pele é um gesto de amor próprio diário.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid ${C.gold};background:${C.creamLight};">
        <tr><td style="padding:22px 24px;">
          <p style="margin:0 0 10px;font-family:${FONT_SERIF};font-style:italic;font-size:15px;color:${C.navyDeep};line-height:1.7;">"Cada pele tem sua história, seu ritmo e suas necessidades. Este protocolo foi pensado especificamente para você. Resultados reais nascem da consistência. Confie no processo."</p>
          <p style="margin:0;text-align:right;font-family:${FONT_SANS};font-size:11px;color:${C.textMuted};letter-spacing:0.08em;">— Patrícia Elias</p>
        </td></tr>
      </table>

      <p style="margin:36px 0 14px;text-align:center;font-family:${FONT_SANS};font-size:14px;color:${C.gold};letter-spacing:0.5em;">✦ &nbsp; ✦ &nbsp; ✦</p>

      <h3 style="margin:18px 0 6px;font-family:${FONT_SERIF};font-weight:400;font-size:24px;color:${C.navyDeep};">Seu diagnóstico</h3>
      <p style="margin:0 0 18px;font-family:${FONT_SANS};font-size:13px;color:${C.textMuted};line-height:1.7;">Identificamos os pontos centrais do seu cuidado e desenhamos um protocolo que ajusta o que precisa de atenção e introduz os ativos certos para sua queixa principal.</p>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="48%" valign="top" style="padding:0 6px 12px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.borderSoft};border-radius:6px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0 0 6px;font-family:${FONT_SANS};font-size:9px;letter-spacing:0.22em;color:${C.gold};text-transform:uppercase;font-weight:600;">Queixa Principal</p>
                <p style="margin:0;font-family:${FONT_SERIF};font-size:14px;color:${C.navyDeep};line-height:1.4;">${escapeHtml(queixa)}</p>
              </td></tr>
            </table>
          </td>
          <td width="48%" valign="top" style="padding:0 0 12px 6px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.borderSoft};border-radius:6px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0 0 6px;font-family:${FONT_SANS};font-size:9px;letter-spacing:0.22em;color:${C.gold};text-transform:uppercase;font-weight:600;">Tipo de Pele</p>
                <p style="margin:0;font-family:${FONT_SERIF};font-size:14px;color:${C.navyDeep};line-height:1.4;">${escapeHtml(tipoPele)}</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td valign="top" colspan="2" style="padding:0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.borderSoft};border-radius:6px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0 0 6px;font-family:${FONT_SANS};font-size:9px;letter-spacing:0.22em;color:${C.gold};text-transform:uppercase;font-weight:600;">Foco do Protocolo</p>
                <p style="margin:0;font-family:${FONT_SERIF};font-size:14px;color:${C.navyDeep};line-height:1.4;">${escapeHtml(foco)}</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
        <tr>
          ${metricaPill('Oleosidade', det.nivelOleosidade)}
          ${metricaPill('Acne', det.nivelAcne)}
          ${metricaPill('Sensibilidade', det.nivelSensibilidade)}
        </tr>
      </table>

      ${det.observacoes && det.observacoes.trim() ? `
        <h3 style="margin:30px 0 8px;font-family:${FONT_SERIF};font-weight:400;font-size:20px;color:${C.navyDeep};">O que observamos na sua pele</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.creamLight};border-left:3px solid ${C.gold};border-radius:0 6px 6px 0;">
          <tr><td style="padding:18px 22px;">
            <p style="margin:0;font-family:${FONT_SERIF};font-style:italic;font-size:14px;color:${C.navyText};line-height:1.75;">${escapeHtml(det.observacoes)}</p>
          </td></tr>
        </table>
      ` : ''}

      <h3 style="margin:30px 0 8px;font-family:${FONT_SERIF};font-weight:400;font-size:20px;color:${C.navyDeep};">Estratégia de tratamento</h3>
      <p style="margin:0 0 12px;font-family:${FONT_SANS};font-size:13px;color:${C.navyText};line-height:1.75;">${escapeHtml(estrategia)}</p>
    </td></tr>

    ${pageFooter()}
  `;
}

// 02 · Rotina Manhã
function secaoRotinaManha(slots: Record<SlotId, SlotProduto | undefined>): string {
  const ordem: SlotId[] = ['limpeza','tonico','iluminador','serum_creme','hidratante','protetor_solar'];
  const passos = ordem.map((id) => slots[id]).filter((s): s is SlotProduto => Boolean(s));
  if (passos.length === 0) return '';

  return `
    ${pageHeader('Rotina Manhã', '02 · Rotina Manhã')}
    <tr><td style="padding:6px 48px 18px;">
      <p style="margin:0 0 22px;font-family:${FONT_SANS};font-size:13px;color:${C.textMuted};line-height:1.7;">O despertar luminoso da sua pele.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td>
          <p style="margin:0 0 18px;padding-bottom:12px;border-bottom:1px solid ${C.borderSoft};">
            <span style="font-family:${FONT_SERIF};font-size:18px;color:${C.navyDeep};">☀ &nbsp;Ritual Diurno</span>
            <span style="float:right;font-family:${FONT_SANS};font-size:10px;letter-spacing:0.22em;color:${C.gold};text-transform:uppercase;font-weight:600;line-height:28px;">Todos os dias</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
    ${passos.map((s, i) => passo(i + 1, s)).join('')}
    ${pageFooter()}
  `;
}

// 03 · Rotina Noite com ativo renovador (omite se não houver)
function secaoRotinaNoiteAtivo(slots: Record<SlotId, SlotProduto | undefined>): string {
  if (!slots.ativo_renovador) return '';
  const ordem: SlotId[] = ['limpeza','tonico','ativo_renovador','serum_creme','hidratante'];
  const passos = ordem.map((id) => slots[id]).filter((s): s is SlotProduto => Boolean(s));

  return `
    ${pageHeader('Rotina Noite', '03 · Rotina Noite')}
    <tr><td style="padding:6px 48px 18px;">
      <p style="margin:0 0 22px;font-family:${FONT_SANS};font-size:13px;color:${C.textMuted};line-height:1.7;">Renovação e regeneração enquanto você descansa.</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td>
          <p style="margin:0 0 18px;padding-bottom:12px;border-bottom:1px solid ${C.borderSoft};">
            <span style="font-family:${FONT_SERIF};font-size:18px;color:${C.navyDeep};">☾ &nbsp;Noites com Renovador</span>
            <span style="float:right;font-family:${FONT_SANS};font-size:10px;letter-spacing:0.22em;color:${C.gold};text-transform:uppercase;font-weight:600;line-height:28px;">Seg · Qua · Sex</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
    ${passos.map((s, i) => passo(i + 1, s)).join('')}
    ${pageFooter()}
  `;
}

// 04 · Rotina Noite sem ativo (nutrição)
function secaoRotinaNoiteNutricao(slots: Record<SlotId, SlotProduto | undefined>): string {
  // Quando não há ativo, esta vira a rotina noturna padrão (todas as noites).
  const todasNoites = !slots.ativo_renovador;
  const ordem: SlotId[] = ['limpeza','tonico','iluminador','serum_creme','selante_nutritivo'];
  const passos = ordem.map((id) => slots[id]).filter((s): s is SlotProduto => Boolean(s));
  if (passos.length < 3) return ''; // se não tem nem o básico, omite

  return `
    ${pageHeader(todasNoites ? 'Rotina Noite' : 'Noites de Nutrição', `04 · Rotina Noite`)}
    <tr><td style="padding:6px 48px 18px;">
      <p style="margin:0 0 22px;font-family:${FONT_SANS};font-size:13px;color:${C.textMuted};line-height:1.7;">${todasNoites ? 'Hidratação e nutrição profunda enquanto você descansa.' : 'Quando a pele descansa do ativo renovador.'}</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td>
          <p style="margin:0 0 18px;padding-bottom:12px;border-bottom:1px solid ${C.borderSoft};">
            <span style="font-family:${FONT_SERIF};font-size:18px;color:${C.navyDeep};">☾ &nbsp;${todasNoites ? 'Ritual Noturno' : 'Noites sem Renovador'}</span>
            <span style="float:right;font-family:${FONT_SANS};font-size:10px;letter-spacing:0.22em;color:${C.gold};text-transform:uppercase;font-weight:600;line-height:28px;">${todasNoites ? 'Todas as noites' : 'Ter · Qui · Sáb · Dom'}</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
    ${passos.map((s, i) => passo(i + 1, s)).join('')}
    ${pageFooter()}
  `;
}

// 05 · Tratamento Interno (suplemento)
function secaoTratamentoInterno(slots: Record<SlotId, SlotProduto | undefined>): string {
  const s = slots.suplemento;
  if (!s) return '';
  const link = s.produto.link ? escapeHtml(s.produto.link) : '';
  return `
    ${pageHeader('Beleza de Dentro para Fora', '05 · Tratamento Interno')}
    <tr><td style="padding:6px 48px 22px;">
      <p style="margin:0 0 22px;font-family:${FONT_SANS};font-size:13px;color:${C.textMuted};line-height:1.7;">A pele jovem se constrói também por dentro.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};border-radius:6px;">
        <tr><td style="padding:30px 28px;text-align:center;">
          <p style="margin:0 0 6px;font-family:${FONT_SANS};font-size:10px;letter-spacing:0.28em;color:${C.gold};text-transform:uppercase;font-weight:600;">Recomendação Especial</p>
          <p style="margin:0 0 6px;font-family:${FONT_SERIF};font-size:28px;color:${C.navyDeep};font-weight:400;">${escapeHtml(s.produto.nome)}</p>
          <p style="margin:0;font-family:${FONT_SERIF};font-style:italic;font-size:13px;color:${C.textMuted};">A juventude que você toma todos os dias</p>
        </td></tr>
      </table>

      <p style="margin:24px 0 18px;font-family:${FONT_SANS};font-size:13px;color:${C.navyText};line-height:1.75;">Por mais completa que seja sua rotina tópica, parte do envelhecimento da pele acontece em camadas que cremes e séruns não alcançam. O suplemento atua na estrutura profunda da pele, repondo o que o tempo naturalmente reduz.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.borderSoft};border-radius:6px;">
        <tr><td style="padding:18px 22px;">
          <p style="margin:0 0 10px;font-family:${FONT_SANS};font-size:11px;letter-spacing:0.18em;color:${C.gold};text-transform:uppercase;font-weight:700;">Como tomar</p>
          <p style="margin:0 0 14px;font-family:${FONT_SANS};font-size:13px;color:${C.navyText};line-height:1.7;">${escapeHtml(s.slot.comoUsar)}</p>
          <p style="margin:0 0 10px;font-family:${FONT_SANS};font-size:11px;letter-spacing:0.18em;color:${C.gold};text-transform:uppercase;font-weight:700;">Uso contínuo</p>
          <p style="margin:0;font-family:${FONT_SANS};font-size:13px;color:${C.navyText};line-height:1.7;">Os primeiros resultados aparecem entre 60 e 90 dias. A constância é o que garante a manutenção da pele jovem ao longo dos anos.</p>
        </td></tr>
      </table>

      ${link ? `<p style="margin:22px 0 0;text-align:center;"><a href="${link}" style="display:inline-block;padding:12px 28px;background:${C.navyDeep};color:#fff;text-decoration:none;font-family:${FONT_SANS};font-size:12px;font-weight:600;letter-spacing:0.1em;border-radius:4px;">Conhecer o produto →</a></p>` : ''}
    </td></tr>
    ${pageFooter()}
  `;
}

// 06 · Regras de Ouro + Jornada
function secaoRegrasJornada(slots: Record<SlotId, SlotProduto | undefined>): string {
  const regras: string[] = [
    '<strong>Protetor solar todos os dias.</strong> Sem exceção. Mesmo em casa, mesmo nublado. Os raios UVA atravessam vidros e são a principal causa do fotoenvelhecimento.',
    slots.ativo_renovador
      ? '<strong>Renovador sempre em pele 100% seca.</strong> Pele úmida potencializa absorção e aumenta o risco de irritação. Aguarde o tônico secar completamente antes da aplicação.'
      : '<strong>Aplique os ativos em camadas finas.</strong> Mais produto não significa mais resultado — significa maior risco de irritação.',
    '<strong>Constância acima de intensidade.</strong> Uma rotina simples feita todos os dias entrega muito mais que uma rotina perfeita feita de vez em quando.',
    '<strong>Se descamar muito,</strong> intercale mais dias entre as aplicações do ativo renovador e reforce o hidratante para acalmar.',
  ];

  return `
    ${pageHeader('Regras de Ouro', '06 · Regras & Resultados')}
    <tr><td style="padding:6px 48px 18px;">
      <p style="margin:0 0 22px;font-family:${FONT_SANS};font-size:13px;color:${C.textMuted};line-height:1.7;">Os princípios que garantem resultados reais.</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.creamLight};border-radius:6px;">
        ${regras.map((r, i) => `
          <tr><td style="padding:${i === 0 ? '20px' : '14px'} 22px ${i === regras.length - 1 ? '20px' : '14px'};border-bottom:${i === regras.length - 1 ? 'none' : `1px solid ${C.borderSoft}`};">
            <table width="100%" cellpadding="0" cellspacing="0"><tr>
              <td width="32" valign="top" style="font-family:${FONT_SERIF};font-size:18px;color:${C.gold};font-style:italic;">${['I','II','III','IV'][i] ?? String(i+1)}</td>
              <td style="font-family:${FONT_SANS};font-size:13px;color:${C.navyText};line-height:1.7;">${r}</td>
            </tr></table>
          </td></tr>
        `).join('')}
      </table>

      <h3 style="margin:36px 0 8px;font-family:${FONT_SERIF};font-weight:400;font-size:22px;color:${C.navyDeep};">Sua jornada de transformação</h3>
      <p style="margin:0 0 18px;font-family:${FONT_SANS};font-size:13px;color:${C.textMuted};line-height:1.7;">Resultados reais acontecem com o tempo. Aqui está o que esperar — e celebrar — em cada etapa.</p>

      ${[
        ['15', 'DIAS', 'Primeiros sinais de mudança', 'Pele mais hidratada, viço perceptível, sensação de conforto e maciez no toque. A barreira cutânea começa a se fortalecer.'],
        ['30', 'DIAS', 'Resultados visíveis', 'Linhas finas atenuadas. Tom de pele mais uniforme. Maior luminosidade e firmeza no toque.'],
        ['60-90', 'DIAS', 'Transformação consolidada', 'Resultado estrutural visível. Firmeza renovada, qualidade de pele superior e luminosidade característica de quem se cuida com excelência.'],
      ].map(([num, lbl, titulo, desc]) => `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border:1px solid ${C.borderSoft};border-radius:6px;">
          <tr>
            <td width="90" align="center" style="padding:18px 0;border-right:1px solid ${C.borderSoft};">
              <p style="margin:0;font-family:${FONT_SERIF};font-size:26px;color:${C.gold};font-style:italic;line-height:1;">${num}</p>
              <p style="margin:4px 0 0;font-family:${FONT_SANS};font-size:9px;letter-spacing:0.22em;color:${C.textMuted};">${lbl}</p>
            </td>
            <td style="padding:14px 20px;">
              <p style="margin:0 0 4px;font-family:${FONT_SERIF};font-size:15px;color:${C.navyDeep};">${titulo}</p>
              <p style="margin:0;font-family:${FONT_SANS};font-size:12px;color:${C.navyText};line-height:1.65;">${desc}</p>
            </td>
          </tr>
        </table>
      `).join('')}
    </td></tr>
    ${pageFooter()}
  `;
}

// 07 · Encerramento
function secaoEncerramento(clinic?: { senderName?: string | null; brandName?: string | null }): string {
  const marca = clinic?.brandName || clinic?.senderName || 'Patrícia Elias';
  return `
    <tr><td style="background:${C.cream};padding:60px 48px;text-align:center;">
      <p style="margin:0 0 14px;font-family:${FONT_SANS};font-size:10px;letter-spacing:0.4em;color:${C.gold};text-transform:uppercase;font-weight:600;">Encerramento</p>
      <h2 style="margin:0 0 22px;font-family:${FONT_SERIF};font-weight:400;font-size:36px;color:${C.navyDeep};line-height:1.15;">Sua pele merece<br>esse cuidado</h2>
      <p style="margin:0 0 28px;max-width:440px;display:inline-block;font-family:${FONT_SERIF};font-style:italic;font-size:14px;color:${C.navyText};line-height:1.75;">"Cada produto deste protocolo foi pensado para entregar o melhor à sua pele. Confie na rotina, seja consistente e nos conte sua evolução. Estamos com você em cada etapa dessa jornada."</p>
      <div style="display:inline-block;width:60px;height:1px;background:${C.gold};margin:0 0 22px;"></div>
      <p style="margin:0 0 8px;font-family:${FONT_SANS};font-size:10px;letter-spacing:0.3em;color:${C.textMuted};text-transform:uppercase;">Estamos à disposição</p>
      <p style="margin:0 0 22px;font-family:${FONT_SANS};font-size:13px;color:${C.navyDeep};line-height:1.9;">
        <strong>WhatsApp:</strong> 11 98937-4885<br>
        <strong>Loja Online:</strong> patriciaelias.com.br<br>
        <strong>Instagram:</strong> @lojapatriciaelias
      </p>
      <p style="margin:30px 0 0;font-family:${FONT_SERIF};font-size:22px;color:${C.navyDeep};">${escapeHtml(marca)}</p>
      <p style="margin:4px 0 0;font-family:${FONT_SANS};font-size:9px;letter-spacing:0.32em;color:${C.textMuted};text-transform:uppercase;">Estética & Saúde</p>
    </td></tr>
    <tr><td style="background:${C.navyDeep};padding:18px 48px;text-align:center;">
      <p style="margin:0;font-family:${FONT_SANS};font-size:9px;letter-spacing:0.28em;color:rgba(255,255,255,.5);text-transform:uppercase;">© ${new Date().getFullYear()} Patrícia Elias Dermocosméticos · Todos os direitos reservados</p>
    </td></tr>
  `;
}

export function renderProtocoloEmail(
  nome: string,
  resultado: ResultadoAnalise,
  clinic?: { senderName?: string | null; brandName?: string | null } | null,
): string {
  const p = resultado.protocolo;
  const map = slotMap(p);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Seu Protocolo Personalizado</title>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};padding:0 0 40px;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:${C.white};box-shadow:0 8px 40px rgba(26,58,95,.12);">

  ${secaoBoasVindas(nome, p.queixaPrincipal, p.focoProtocolo, p.estrategia, resultado.tipoPele, {
    nivelOleosidade: resultado.nivelOleosidade,
    nivelAcne: resultado.nivelAcne,
    nivelSensibilidade: resultado.nivelSensibilidade,
    observacoes: resultado.observacoes,
  })}
  ${secaoRotinaManha(map)}
  ${secaoRotinaNoiteAtivo(map)}
  ${secaoRotinaNoiteNutricao(map)}
  ${secaoTratamentoInterno(map)}
  ${secaoRegrasJornada(map)}
  ${secaoEncerramento(clinic ?? undefined)}

</table>
</td></tr>
</table>
</body>
</html>`;
}
