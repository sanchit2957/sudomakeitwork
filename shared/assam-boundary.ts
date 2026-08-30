/**
 * Assam boundary derived from geoBoundaries India ADM1 (2011), which attributes
 * DataMeet India community / Election Commission of India under CC BY 2.5 India.
 * Source metadata: https://www.geoboundaries.org/api/current/gbOpen/IND/ADM1/
 */
export type AssamPoint = { lat: number; lng: number };

const ASSAM_BOUNDARY_ENCODED = "wp~cDqu_dQagAiiFluBwwAusNadT_VawAf|Akc@}mEi~GyU}jEieIirAshDjw@ykImaIxKu_FnfFihGydD}{XmxEgwNteAuYexAmqI`dB~PpaBa`F_gD{\\}rDsgKs{GiuDss@mqDqhKnmHtr@fzAomB~rAlQjoEn`FhgCqfFlQ`jDjrCgtAp}A{vMugGsaHr}@s~DpeKswCcHkBdzCyyCvlA_nB{jBybBl}CgkCc|Buk@|mC{eFj}Aez@agDo{B`TqwL}`Kmt@akEiqHwtIeo@zz@av@_jCgrKspEwu@fx[jhBfui@riMdsOzeGlmZgsDryL`aVdnjAnjCjtLtgDbfA|`@ffHnwEjuFw[~}KhwBt_@xkMf{b@{WdcCraCncByxGvzDjaD|eLkkD|yKbmAlaC_zCroCgfCqm@|RzuCnkDjnDzl@cjBxrCpInsB{qEhwEwz@l~GlxTvqAgP~sIlsLn{GbyDlnEnkLjab@zdc@nnAdeAryBk|D`aEmnA~rBlt@tu@t`DgxAzz@pyAig@~f@veB}vAfOtfBdQ{pAhm@dlCnTlsBhrG|_HdiHtuCfkPvuAbtUuwAvgCux@xrWfbHjwy@otHlmSaxB}F_lBveEmfEhyh@dxG~kDnhDb_KpCdpYftEbrHq|@rzEjiAhyJz_B}@d_@~fD`r@rs^beDtgAd`Cr_H}dAvdMg{JfuPna@bqE|rH`{E|cJxdY}wA`pKjyDbpXepHt_PhvGffE`{A|qF{bEhsRg~@tdZ~`G|nGu}@|dKzjCvst@{bBx`Grn@xvDikB`kA{lC|cPibP~`XdTn~Jn_D`v@pfDlfHe_ApsL`bIflGvoEsj@j{BztIl|D`z`@cfAdaTr{Deg@dn@xrA|`IezAvkC~fB`x@mzBjzDe\\fq@`gB~rOpo@hgFkwBn_EtcCt|@gt@qDdgCrwBvg@m~@}pBb_Ce~@pOtcElsDn[u}BO`}BfuFv|B_IreAlgE|jEih@aqBdhFrgFsrBj`Al`FplCoyDdtBrdE~p@qpEtn@njCv}AeHoU`zAbuBceAo_@cmClsBzjA|AmfDdrDgxBfbCb}@hQelDriChOsa@}nAfuDkXnbC~zCiK_oDheCnuA{yCq`Ct_J}hAd^u_Bo|Dq@`|EucF`j@l`EncCqm@~SduCnCabKdmMlpIz_EaK~}CfrB|uHstCz|ExoAryA_fC|vOcfElgOx}A~k@xzApdMLkcGcwE_eBnoBcbDe`AuoCeiQ_nB}eAjc@{xB{hCyjBukHfsLqmPd{I{AwjGsvEagCs{GhdAauAwxIsaCetBqqBlgBatA}tApZmoCqoLelMi|@sxEdlCu~EwgB}bBkmA{xVukFggHyFikD~rC_~Cu`Cm}H~uJ}nJhmIb|BibKqfM`uBqaF~kCrnBjtBo`BmhCc|@mzEcxOcJu}DfkBbo@f}@_uA~qAz}Ayb@ueC`xAqc@_wGwiG`XqhDzhAnCstAsqHpaF}hEu|DcBaVc{D~gK{dCuBq`KzwKhxCcsDwfGaUg|DrqCbxDbt@yqAwxD{tOvg@gkE{kBo`BrpByo@rzKr}CluIesGgmDqdIcrPa{JavAm_Pb{AylC_dE_tO{zB`Wn}C`sA}r@nnFmdJkcKzzBvhEcmHwrAkhBinEaaJwqDx}AqmBiWwpEn{El^hnCqzAvcDfbEvnEa}J_tHktHiqSocAmcD{wJqtEwsE|dCaoIv|IfiAleCggHtlCyYk}F}tLub@g`[woE{dF|iAkrSfjElfAvkHbcOh}FxpDhoEkMjJsyLrbF~lHt}IjbDtxMqgAfuCjrB|uGkiAp^wvA_qHwuIcq@_eTa}DuzH~lA~L_OgzCtzCmjFpnDxUxeBqxDvnJq{ElHknH~pG_O`tAoaB~b@qjC{tFqjJbtB}s@rhFjsB`tGjoLf{Cdw@sOesEdvIaq@su@ibC}oAlKnkB}uAwbB{vAxhDcq@}n@iiAtaGqtG{h@o|Bd{EgiAfcAkfEptBa_@xeEwa@d`Ff~DxwD{~FxzF~eZf`KveG_uCxnRzxFgnBqz@hlJtsI|tC|fBsl@eg@naDxoIljCtrC{NfNgoHd|CfoBur@amFjxMuB{B`mGbbBne@pm@`nFa`LtpRp{Ah~Kr`B{rAfkGpb@xyAwdEjjGgbBnsF~|@xw@shBblJlbGj|`@riGz`B{yC`gFrg@x{@_gBhhOsqA~oTfxHn^|kBzv@ukDsfBm|GiXgs]ncKtUzvFolB`hBkmDqfDexB}iBszHgbLigB_f@w~JyvN}lAjf@ebCk~Bq`BbIsqCeba@qgNn|RibFvtBa~DfeDpBazCidElm@ceGogCkg@hbCsnHoeBiaBly@}_CqoBezBb_@_aD}`Kig@yfChuAupH_lBouAcaCacBhmA_s@__HcqBpnEojMgmEiqEf~DeqEytEwtLmIfHcuDjlCacA{tCygHqhGfLuuBqdEapFwu@oTgtAmjCdjAcvCubD}bJnvBeaEa~BvSm~E_fHghEq}MutAksLi{E}wKsmPk}EzhC{tFw|Cw}Hv_ByvD`gLozDd]s}IplJ{q@aeE{eNclLj@opE{iC{}E_lGcaD}FusBsgEaGyjDg~CwlBitH}`HmrDiiCeiLguJ|kEspDcsL{eFkwAfjK{{DjaJjpBn~FcoB_iHmsGzqAcfGe{FutEmmE{fK_zOp_D{mK{uEgrSstA}|Cm`E{bIy`B{|AkgDizIe}De_CkqLmuA~xAglD}kBqiHpc@owTyoOa{BwpDn{Na^vdCufDwrC{v@uq@yiD_yAr^{HkwCunDkrD_lGemAsoEj`AqkCafKqqDp_@sYmiEyzFebH|EioCleC{X{iBubAtTofBohF}R{MomA`zCuaAyzBgaMirG_jHj}@mpB_oCiiAukAcjE}pAtm@__@awBymD}QotLs}IkoD}nHhqA}t@o[}|DvuCsdCkq@ktEacFuiNmkMulR";
export const ASSAM_CENTER: AssamPoint = { lat: 26.2006, lng: 92.9376 };
export const ASSAM_MAP_BOUNDS = {"north":27.97157,"south":24.13633,"east":96.01766,"west":89.6986} as const;
export const ASSAM_MAP_RESTRICTION = { latLngBounds: ASSAM_MAP_BOUNDS, strictBounds: true } as const;

function decodeAssamBoundary(encoded: string): AssamPoint[] {
  const points: AssamPoint[] = []; let index = 0; let latitude = 0; let longitude = 0;
  const decodeValue = () => { let result = 0; let shift = 0; let byte: number; do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20); return (result & 1) ? ~(result >> 1) : result >> 1; };
  while (index < encoded.length) { latitude += decodeValue(); longitude += decodeValue(); points.push({ lat: latitude / 1e5, lng: longitude / 1e5 }); }
  return points;
}

export const ASSAM_BOUNDARY = decodeAssamBoundary(ASSAM_BOUNDARY_ENCODED);

export function isPointInAssam(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < ASSAM_MAP_BOUNDS.south || latitude > ASSAM_MAP_BOUNDS.north || longitude < ASSAM_MAP_BOUNDS.west || longitude > ASSAM_MAP_BOUNDS.east) return false;
  let inside = false;
  for (let index = 0, previous = ASSAM_BOUNDARY.length - 1; index < ASSAM_BOUNDARY.length; previous = index++) {
    const currentPoint = ASSAM_BOUNDARY[index]; const previousPoint = ASSAM_BOUNDARY[previous];
    const crosses = (currentPoint.lat > latitude) !== (previousPoint.lat > latitude) && longitude < ((previousPoint.lng - currentPoint.lng) * (latitude - currentPoint.lat)) / (previousPoint.lat - currentPoint.lat) + currentPoint.lng;
    if (crosses) inside = !inside;
  }
  return inside;
}
