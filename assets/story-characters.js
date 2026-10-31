/* Original Covenant story cast. Authored vector artwork; no runtime dependencies. */
(function (root) {
  'use strict';

  const INK = '#15344a';
  const POSES = Object.freeze(['neutral', 'thinking', 'talking', 'hopeful', 'happy', 'worried', 'firm', 'surprised']);
  const CAST = Object.freeze([
    { id: 'akari', name: 'Akari', role: 'Thoughtful buyer', skin: '#edba95', shade: '#c98a72', hair: '#203f59', hairLight: '#385e76', iris: '#3b8b9b', shirt: '#f7efda', sleeve: '#f7efda', cuff: '#d9cdb5', eye: 'soft', eyeSep: 17, face: 'M83 78 C84 53 102 45 121 47 C144 46 158 59 158 80 L153 117 Q148 138 121 151 Q95 140 87 118 Z', back: 'bob', front: 'bob', outfit: 'vest', length: .89, brow: 2, neck: 0, detail: 'A red ribbon and a pocket notebook' },
    { id: 'ren', name: 'Ren', role: 'Ambitious provider', skin: '#dca47c', shade: '#b87859', hair: '#a95835', hairLight: '#d18953', iris: '#b77935', shirt: '#294963', sleeve: '#294963', cuff: '#42647b', eye: 'sharp', eyeSep: 17.5, face: 'M82 78 Q83 48 119 46 Q155 48 159 78 L156 112 Q150 137 123 151 L108 146 Q88 130 85 111 Z', back: 'crop', front: 'tousled', outfit: 'scarf', length: .86, brow: 2.7, neck: 1, detail: 'An ochre scarf and a copper lapel pin' },
    { id: 'yuki', name: 'Yuki', role: 'Meticulous inspector', skin: '#e9c7aa', shade: '#bf9a86', hair: '#bccdd1', hairLight: '#eff3e8', iris: '#728c85', shirt: '#27575e', sleeve: '#27575e', cuff: '#48777a', eye: 'sharp', eyeSep: 17, face: 'M85 77 Q87 50 119 47 Q150 47 155 76 L153 113 L144 134 L120 151 L98 137 L88 116 Z', back: 'short', front: 'silver', outfit: 'inspector', length: .88, brow: 1.7, neck: 0, detail: 'Fine spectacles and a silver pen' },
    { id: 'kai', name: 'Kai', role: 'Practical engineer', skin: '#bb805b', shade: '#965941', hair: '#263a42', hairLight: '#45616b', iris: '#79532e', shirt: '#66b4bc', sleeve: '#66b4bc', cuff: '#d9e4d5', eye: 'heavy', eyeSep: 18, face: 'M79 77 Q81 50 118 47 Q152 47 161 77 L158 115 Q153 139 135 146 L111 149 L95 138 Q82 127 82 109 Z', back: 'crop', front: 'wavy', outfit: 'workshirt', length: .52, brow: 3.1, neck: 2, detail: 'Rolled sleeves and a well used pencil' },
    { id: 'mio', name: 'Mio', role: 'Playful artist', skin: '#d99a79', shade: '#b57363', hair: '#6b4d7b', hairLight: '#9877aa', iris: '#7162a3', shirt: '#e8c563', sleeve: '#e8c563', cuff: '#f5dd8e', eye: 'round', eyeSep: 17.5, face: 'M81 79 Q82 49 120 47 Q158 48 160 80 L155 116 Q148 139 121 149 Q92 139 86 118 Z', back: 'curls', front: 'curly', outfit: 'cardigan', length: .82, brow: 2.2, neck: 0, detail: 'Golden drop earrings and a paint patch' },
    { id: 'nox', name: 'Nox', role: 'Calm guardian', skin: '#9c6b55', shade: '#744d43', hair: '#26343d', hairLight: '#41505b', iris: '#b79c65', shirt: '#514257', sleeve: '#514257', cuff: '#79657c', eye: 'heavy', eyeSep: 16.5, face: 'M85 78 Q85 47 119 46 Q153 47 156 78 L152 116 Q147 139 121 154 Q98 139 89 118 Z', back: 'long', front: 'long', outfit: 'guardian', length: .91, brow: 2, neck: 1, detail: 'A silver hair clasp and a quiet seal' },
    { id: 'sora', name: 'Sora', role: 'Resourceful operations', skin: '#c38d64', shade: '#9f674c', hair: '#67483b', hairLight: '#997055', iris: '#6b8054', shirt: '#b76d45', sleeve: '#b76d45', cuff: '#d9a174', eye: 'soft', eyeSep: 17, face: 'M84 77 Q84 51 117 47 Q152 46 157 77 L154 115 Q148 139 121 152 Q96 140 87 119 Z', back: 'ponytail', front: 'tied', outfit: 'field', length: .72, brow: 2.4, neck: 0, detail: 'Tied hair and a little key charm' },
    { id: 'iona', name: 'Iona', role: 'Steady field delivery', skin: '#82543e', shade: '#623e34', hair: '#2e3037', hairLight: '#51525a', iris: '#b69557', shirt: '#397e81', sleeve: '#397e81', cuff: '#bcd1bf', eye: 'wide', eyeSep: 17.8, face: 'M80 77 Q82 48 120 47 Q158 48 161 78 L157 116 Q152 137 135 146 Q120 153 107 147 Q88 138 84 117 Z', back: 'shortcurls', front: 'shortcurls', outfit: 'delivery', length: .82, brow: 2.6, neck: 2, detail: 'A canvas delivery strap and a parcel patch' }
  ].map(Object.freeze));
  const BY_ID = Object.freeze(CAST.reduce(function (map, item) { map[item.id] = item; return map; }, Object.create(null)));
  const EMOTIONS = Object.freeze({ neutral: 'at ease', thinking: 'thinking carefully', talking: 'explaining with an open hand', hopeful: 'hopeful', happy: 'delighted', worried: 'worried', firm: 'resolute', surprised: 'surprised' });
  const GESTURES = Object.freeze({
    neutral: { left: [[70,186],[56,238],[63,294],180,'rest'], right: [[170,186],[184,239],[178,294],180,'rest'], tilt: -1, lean: 0, lift: 0 },
    thinking: { left: [[70,187],[58,239],[70,294],168,'rest'], right: [[170,187],[192,224],[142,156],-26,'point'], tilt: -7, lean: -1, lift: 0 },
    talking: { left: [[70,188],[54,239],[66,293],167,'rest'], right: [[170,184],[192,210],[199,160],18,'open'], tilt: -3, lean: -1, lift: -2 },
    hopeful: { left: [[70,184],[71,237],[107,218],48,'soft'], right: [[170,184],[172,236],[132,219],-48,'soft'], tilt: 3, lean: 0, lift: -3 },
    happy: { left: [[70,182],[43,202],[31,158],-36,'open'], right: [[170,182],[198,199],[210,155],36,'open'], tilt: -4, lean: -2, lift: -5 },
    worried: { left: [[70,190],[53,241],[64,294],178,'rest'], right: [[170,185],[197,151],[157,87],-64,'forehead'], tilt: 5, lean: 2, lift: 2 },
    firm: { left: [[70,185],[47,239],[87,267],53,'rest'], right: [[170,185],[194,224],[149,221],-84,'steady'], tilt: 0, lean: 0, lift: -2 },
    surprised: { left: [[70,180],[62,220],[90,188],-22,'open'], right: [[170,180],[182,219],[151,188],22,'open'], tilt: 5, lean: 1, lift: -6 }
  });
  let serial = 0;
  function e(value) { return String(value).replace(/[&<>"']/g, function (ch) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]; }); }
  function n(value) { return Math.round(value * 100) / 100; }
  function path(d, fill, extra) { return '<path d="' + d + '" fill="' + fill + '"' + (extra || '') + '/>'; }
  function line(d, color, width, extra) { return path(d, 'none', ' stroke="' + (color || INK) + '" stroke-width="' + (width || 1.6) + '"' + (extra || '')); }

  function hairBack(c) {
    const common = ' stroke="' + INK + '" stroke-width="2" stroke-linejoin="round"';
    let d = '';
    if (c.back === 'bob') d = 'M79 75 C72 42 94 27 122 29 C154 27 172 47 165 81 L171 153 Q154 168 143 155 L100 157 Q81 166 72 154 Z';
    if (c.back === 'crop') d = 'M79 93 Q68 66 82 43 Q105 22 133 32 Q162 29 168 61 L159 102 L149 120 L90 117 Z';
    if (c.back === 'short') d = 'M81 99 L74 74 Q71 46 97 34 Q127 20 151 39 Q169 46 164 77 L154 112 L93 114 Z';
    if (c.back === 'curls') d = 'M79 63 Q67 50 77 39 Q86 29 98 34 Q109 20 123 29 Q138 22 148 35 Q168 32 172 48 Q183 59 171 75 Q181 86 173 99 Q185 118 174 131 Q180 147 163 155 Q152 167 139 155 L96 158 Q80 166 73 152 Q57 147 66 130 Q54 116 66 103 Q58 88 69 78 Q65 68 79 63 Z';
    if (c.back === 'long') d = 'M78 73 Q74 30 118 26 Q163 25 167 69 L171 151 Q183 196 174 255 Q162 248 152 234 L96 236 Q84 252 64 249 Q76 203 72 159 Z';
    if (c.back === 'ponytail') d = 'M146 40 Q169 19 180 40 Q201 46 190 68 Q184 86 192 108 Q200 135 186 156 Q184 138 172 129 Q174 151 165 161 L155 112 L88 119 Q71 90 78 63 Q79 35 110 29 Q136 26 146 40 Z';
    if (c.back === 'shortcurls') d = 'M80 88 Q68 85 72 73 Q62 62 73 53 Q70 39 83 38 Q87 23 101 30 Q110 18 124 28 Q139 20 148 33 Q162 28 167 43 Q180 47 173 61 Q184 71 173 81 L159 111 L84 110 Z';
    return '<g class="character-hair hair-back">' + path(d, c.hair, common) + '</g>';
  }

  function hairFront(c) {
    const edge = ' stroke="' + INK + '" stroke-width="1.9" stroke-linejoin="round"';
    let art = '';
    if (c.front === 'bob') {
      art = path('M78 83 Q77 37 114 35 Q154 30 165 65 L160 107 L151 94 L149 68 Q137 84 118 86 L129 61 Q115 80 94 84 L95 64 L84 107 Z', c.hair, edge) + line('M86 62 Q92 45 110 44 M131 43 Q150 44 155 63 M78 112 L80 145 M160 112 L164 144', c.hairLight, 2.4) + path('M158 66 Q166 53 177 58 L173 73 L180 85 Q166 89 158 75 Q149 85 143 77 L145 64 Z', '#ad4d4d', edge) + path('M159 68 L166 72 L159 77 L154 72 Z', '#dc8e76', ' stroke="' + INK + '" stroke-width="1.4"') + line('M160 74 L153 91 M164 76 L168 94', '#ad4d4d', 4);
    } else if (c.front === 'tousled') {
      art = path('M78 87 L72 68 L79 52 L74 49 L96 38 L91 29 L115 34 L128 25 L137 35 L153 32 L153 42 L168 50 L163 68 L166 77 L153 100 L151 70 L135 75 L141 54 L118 72 L120 53 L98 76 L97 62 L86 98 Z', c.hair, edge) + line('M88 53 L108 43 M127 42 L118 59 M145 48 L152 59 M78 69 L87 62', c.hairLight, 2.7) + line('M91 126 L94 130 M98 135 L102 138 M139 134 L143 130', c.shade, 1.3);
    } else if (c.front === 'silver') {
      art = path('M78 82 L76 63 Q81 32 115 31 Q145 27 163 51 L159 76 L153 99 L149 70 L135 82 L137 58 L118 79 L122 55 L103 74 L104 55 L89 88 L87 105 Z', c.hair, edge) + line('M86 56 Q94 42 111 40 M129 39 Q147 39 155 54 M106 51 L97 64 M144 51 L137 65', c.hairLight, 3);
    } else if (c.front === 'wavy') {
      art = path('M77 87 Q68 72 79 62 Q74 49 88 43 Q89 31 104 34 Q117 23 130 34 Q145 27 151 41 Q167 40 166 56 Q178 67 164 80 L157 103 L151 77 Q140 72 142 60 Q128 75 115 66 Q105 78 95 68 L87 101 Z', c.hair, edge) + line('M86 55 Q88 44 102 46 Q109 35 121 43 M135 44 Q151 41 155 57 M83 72 Q91 78 96 70', c.hairLight, 2.6);
    } else if (c.front === 'curly') {
      art = path('M76 88 Q67 78 76 68 Q68 56 82 50 Q77 38 94 39 Q102 25 115 37 Q128 24 140 37 Q157 31 161 47 Q176 49 166 65 Q178 75 165 88 L155 107 L151 81 Q137 84 137 69 Q126 80 115 68 Q101 81 92 70 L85 110 Z', c.hair, edge) + line('M83 53 Q87 43 98 51 Q105 56 100 64 M115 43 Q124 34 131 44 Q135 51 129 58 M148 47 Q159 44 160 56 M76 119 Q85 110 91 119 M154 126 Q165 116 170 127 M78 141 Q84 134 90 140', c.hairLight, 2.3);
    } else if (c.front === 'long') {
      art = path('M78 86 Q73 36 116 32 Q159 29 165 65 L159 112 L150 88 L147 56 Q134 74 112 79 L121 54 Q106 73 88 83 L85 119 L79 159 L73 149 Z', c.hair, edge) + line('M87 61 Q98 42 114 41 M136 41 Q151 46 154 64 M80 127 L78 180 M160 120 L169 206', c.hairLight, 2.3) + path('M153 75 L165 79 L164 84 L152 80 Z', '#ced4ca', ' stroke="' + INK + '" stroke-width="1.3"');
    } else if (c.front === 'tied') {
      art = path('M79 84 Q73 44 104 35 Q138 24 158 50 L164 75 L154 101 L150 75 L136 58 Q120 78 95 81 L99 62 Q87 79 86 107 Z', c.hair, edge) + line('M85 59 Q100 42 119 43 M131 42 Q149 43 154 61 M173 54 Q184 57 179 78 M178 96 Q186 114 181 130', c.hairLight, 2.4) + path('M159 43 L170 40 L174 47 L163 51 Z', '#dfbb79', ' stroke="' + INK + '" stroke-width="1.3"') + line('M84 91 Q76 110 84 128 M153 92 Q162 111 155 127', c.hair, 4);
    } else {
      art = path('M77 82 Q66 75 76 65 Q68 54 81 48 Q79 36 94 38 Q100 25 113 35 Q126 25 138 37 Q153 31 158 45 Q174 44 169 59 Q180 66 169 78 L158 101 L150 79 Q140 86 132 75 Q120 85 110 74 Q99 84 91 75 L85 102 Z', c.hair, edge) + line('M82 58 Q89 48 98 57 M106 44 Q117 36 124 47 M139 47 Q149 39 155 51 M95 70 Q102 62 109 70 M128 65 Q137 58 144 68 M156 63 Q166 59 166 69', c.hairLight, 2.2);
    }
    return '<g class="character-hair hair-front">' + art + '</g>';
  }

  function torso(c, pose) {
    const g = GESTURES[pose], lift = g.lift;
    const shoulder = 178 + lift, hem = c.outfit === 'guardian' ? 335 : c.outfit === 'cardigan' ? 318 : 307;
    const base = 'M105 157 L135 157 Q143 166 165 ' + shoulder + ' Q178 181 180 201 L169 255 L174 ' + hem + ' Q120 ' + (hem + 13) + ' 66 ' + hem + ' L73 254 L60 203 Q62 185 75 ' + shoulder + ' Q97 165 105 157 Z';
    let art = path('M76 285 L166 285 L172 360 L130 360 L121 310 L113 360 L69 360 Z', '#284251', ' stroke="' + INK + '" stroke-width="2"') + line('M121 313 L121 345 M79 335 L78 357 M157 332 L162 357', '#48606b', 1.5);
    art += path('M105 135 L135 135 L137 161 Q134 180 121 182 Q107 177 102 163 Z', c.skin, ' stroke="' + INK + '" stroke-width="1.8"') + path('M105 138 Q119 150 135 138 L135 154 Q119 165 104 154 Z', c.shade, ' opacity=".42"');
    art += path(base, c.shirt, ' stroke="' + INK + '" stroke-width="2"');
    if (c.outfit === 'vest') {
      art += path('M98 168 L120 192 L143 168 L154 180 L153 223 L166 306 L123 311 L120 278 L116 311 L74 306 L87 223 L86 181 Z', '#427783', ' stroke="' + INK + '" stroke-width="1.7"') + path('M103 162 L120 185 L107 195 L94 171 Z M136 162 L121 185 L132 195 L148 173 Z', '#fff5dc', ' stroke="' + INK + '" stroke-width="1.5"') + line('M120 196 L120 281 M83 273 L103 275 M137 274 L157 273', '#254d60', 1.5) + path('M88 273 L104 273 L104 289 L88 288 Z', '#d7bb80', ' stroke="' + INK + '" stroke-width="1.3"') + line('M93 277 L100 278 M93 281 L100 282', '#8c6b4d', 1.1);
      [208,232,256].forEach(function(y){art += '<ellipse cx="120" cy="'+y+'" rx="2.2" ry="2.3" fill="#d8c99e" stroke="'+INK+'" stroke-width="1.1"/>';});
    } else if (c.outfit === 'scarf') {
      art += path('M101 163 L120 180 L140 162 L146 298 L96 300 Z', '#e6e0cd', ' stroke="' + INK + '" stroke-width="1.4"') + path('M92 169 L107 181 L101 203 L114 217 L103 304 L73 308 L83 225 L76 181 Z M148 169 L133 182 L139 203 L128 216 L137 306 L168 305 L158 220 L164 182 Z', '#31556d', ' stroke="' + INK + '" stroke-width="1.5"') + path('M100 153 Q119 164 137 153 L145 168 Q125 183 100 174 L94 164 Z M125 174 L143 177 L137 237 L125 230 Z M103 173 L119 178 L112 216 L100 211 Z', '#d7ad59', ' stroke="' + INK + '" stroke-width="1.6"') + line('M103 163 Q119 173 138 163 M130 184 L131 221 M104 198 L115 200 M129 230 L136 233', '#a77f38', 1.4) + path('M86 208 L94 204 L96 213 L88 217 Z', '#bd7a4e', ' stroke="' + INK + '" stroke-width="1.2"') + line('M80 270 L100 267 M143 267 L161 270', '#638095', 1.4);
    } else if (c.outfit === 'inspector') {
      art += path('M102 157 L137 157 L143 181 L120 191 L97 180 Z', '#24454f', ' stroke="' + INK + '" stroke-width="1.5"') + path('M75 179 L94 176 L104 208 L77 219 L65 200 Z M145 176 L164 179 L175 201 L149 210 Z', '#43777a', ' stroke="' + INK + '" stroke-width="1.4"') + line('M120 188 L120 306', '#b4c8bf', 2) + line('M124 195 L124 306 M82 281 L105 281 M136 281 L159 281', '#1d414d', 1.3) + path('M138 209 L158 209 L157 235 L137 235 Z', '#214952', ' stroke="' + INK + '" stroke-width="1.4"') + line('M148 202 L147 222', '#d2dace', 3) + path('M116 196 L124 196 L123 205 L117 205 Z', '#becabe', ' stroke="' + INK + '" stroke-width="1.1"');
    } else if (c.outfit === 'workshirt') {
      art += path('M103 160 L120 177 L138 160 L146 174 L132 192 L120 179 L109 193 L95 174 Z', '#a5d5d2', ' stroke="' + INK + '" stroke-width="1.6"') + line('M120 181 L120 305 M125 190 L125 304 M79 224 L105 224 L105 245 Q91 253 79 245 Z M138 224 L162 224 L162 245 Q149 252 138 245 Z', '#2f707c', 1.5) + path('M142 214 L146 213 L148 235 L144 236 Z', '#dfbb69', ' stroke="' + INK + '" stroke-width="1.2"') + line('M87 285 L103 283 M139 283 L156 285', '#44929b', 1.6);
      [204,259,285].forEach(function(y){art += '<ellipse cx="120" cy="'+y+'" rx="1.7" ry="1.8" fill="#f0e9c9" stroke="'+INK+'" stroke-width="1"/>';});
    } else if (c.outfit === 'cardigan') {
      art += path('M103 161 Q120 181 138 161 L145 186 L141 315 L98 315 L94 186 Z', '#6b5b82', ' stroke="' + INK + '" stroke-width="1.5"') + path('M97 166 Q98 196 112 215 L105 318 L69 316 L79 230 L75 181 Z M144 166 Q142 198 129 215 L137 318 L172 316 L161 230 L166 181 Z', '#e8c563', ' stroke="' + INK + '" stroke-width="1.7"') + line('M99 180 Q99 201 112 216 L105 317 M141 180 Q140 201 129 216 L137 317 M77 309 L104 310 M137 310 L164 308', '#b59649', 1.5) + path('M143 263 L160 262 L161 281 L143 283 Z', '#f1d99a', ' stroke="' + INK + '" stroke-width="1.2"') + path('M145 269 Q152 263 157 272 L153 279 L147 275 Z', '#a3748d', '') + line('M79 270 L99 272', '#a38d49', 1.4);
    } else if (c.outfit === 'guardian') {
      art += path('M100 155 L120 166 L141 155 L150 182 L133 198 L120 184 L107 198 L91 182 Z', '#66516c', ' stroke="' + INK + '" stroke-width="1.7"') + path('M121 184 L120 335 L174 334 L161 242 L166 182 L148 171 L134 194 Z', '#59495f', ' stroke="' + INK + '" stroke-width="1.5"') + line('M124 202 L124 328 M82 276 L103 272 M139 272 L159 277', '#8b788e', 1.4) + path('M116 200 L125 200 L126 209 L116 209 Z', '#c5cabb', ' stroke="' + INK + '" stroke-width="1.2"') + path('M145 220 L153 224 L151 233 L143 234 L139 226 Z', '#a494ad', ' stroke="' + INK + '" stroke-width="1.2"') + line('M143 226 L149 229 L150 224', '#4f4057', 1.3);
    } else if (c.outfit === 'field') {
      art += path('M104 162 L120 179 L137 162 L143 299 L98 300 Z', '#ebe0c0', ' stroke="' + INK + '" stroke-width="1.4"') + path('M98 165 L111 183 L104 202 L114 212 L107 308 L72 307 L83 227 L77 182 Z M144 165 L131 184 L138 201 L127 213 L136 309 L169 306 L158 226 L164 181 Z', '#b76d45', ' stroke="' + INK + '" stroke-width="1.5"') + path('M82 222 L102 222 L102 246 L82 247 Z M140 222 L159 222 L159 246 L140 247 Z', '#a65c3b', ' stroke="' + INK + '" stroke-width="1.3"') + line('M82 228 L102 228 M140 228 L159 228 M81 290 L99 290', '#db9e70', 1.4) + path('M146 281 Q155 276 155 285 Q153 293 148 287 Z', '#c7c8a8', ' stroke="' + INK + '" stroke-width="1.3"') + line('M150 289 L150 302 L154 302 M150 297 L154 297', '#cabd8c', 2.4);
    } else {
      art += path('M101 160 L120 178 L140 160 L149 177 L135 196 L120 182 L105 196 L92 177 Z', '#a8c6b6', ' stroke="' + INK + '" stroke-width="1.6"') + line('M120 185 L120 309 M82 276 L104 273 M138 273 L159 276', '#245c66', 1.6) + path('M149 181 L161 190 L93 312 L81 305 Z', '#c6b895', ' stroke="' + INK + '" stroke-width="1.5"') + line('M154 191 L88 306', '#9a8a6a', 1.3) + path('M135 218 L157 218 L157 237 L135 237 Z', '#bad1bc', ' stroke="' + INK + '" stroke-width="1.4"') + path('M139 224 L145 221 L152 224 L152 232 L145 235 L139 231 Z', '#9d8f70', ' stroke="' + INK + '" stroke-width="1.1"') + line('M139 224 L145 227 L152 224 M145 227 L145 235', INK, 1.1);
    }
    art += line('M76 253 Q81 260 88 262 M155 258 Q162 255 166 250', INK, 1.4, ' opacity=".55"');
    return '<g class="character-body" transform="rotate(' + g.lean + ' 120 270)"><g class="body-motion">' + art + '</g></g>';
  }

  function pointAt(points, t) { const s=points[0], q=points[1], w=points[2], a=1-t; return [a*a*s[0]+2*a*t*q[0]+t*t*w[0],a*a*s[1]+2*a*t*q[1]+t*t*w[1]]; }
  function normalAt(points, t) { const s=points[0], q=points[1], w=points[2], dx=2*(1-t)*(q[0]-s[0])+2*t*(w[0]-q[0]),dy=2*(1-t)*(q[1]-s[1])+2*t*(w[1]-q[1]), len=Math.sqrt(dx*dx+dy*dy)||1; return [-dy/len,dx/len]; }
  function contour(points, end, a, b) {
    const plus=[], minus=[];
    for(let i=0;i<=8;i++){const t=end*i/8,p=pointAt(points,t),v=normalAt(points,t),w=a+(b-a)*i/8;plus.push([n(p[0]+v[0]*w),n(p[1]+v[1]*w)]);minus.push([n(p[0]-v[0]*w),n(p[1]-v[1]*w)]);}
    const edge=plus.concat(minus.reverse()), mids=edge.map(function(p,i){const q=edge[(i+1)%edge.length];return [n((p[0]+q[0])/2),n((p[1]+q[1])/2)];});
    return 'M'+mids[mids.length-1].join(' ')+edge.map(function(p,i){return ' Q'+p.join(' ')+' '+mids[i].join(' ');}).join('')+' Z';
  }
  function arm(c, values) {
    const points=values.slice(0,3), t=c.length, cuff=pointAt(points,t), norm=normalAt(points,t), elbow=pointAt(points,.55), en=normalAt(points,.55);
    let art=path(contour(points,1,12.5,5.4),c.skin,' stroke="'+INK+'" stroke-width="1.8" stroke-linejoin="round"');
    art+=path(contour(points,t,15,8.3),c.sleeve,' stroke="'+INK+'" stroke-width="1.8" stroke-linejoin="round"');
    const u=Math.max(0,t-.06), cp=pointAt(points,u), cn=normalAt(points,u);
    art+=path('M'+n(cp[0]+cn[0]*8.8)+' '+n(cp[1]+cn[1]*8.8)+' L'+n(cuff[0]+norm[0]*8.7)+' '+n(cuff[1]+norm[1]*8.7)+' L'+n(cuff[0]-norm[0]*8.7)+' '+n(cuff[1]-norm[1]*8.7)+' L'+n(cp[0]-cn[0]*8.8)+' '+n(cp[1]-cn[1]*8.8)+' Z',c.cuff,' stroke="'+INK+'" stroke-width="1.25"');
    art+=line('M'+n(elbow[0]+en[0]*8)+' '+n(elbow[1]+en[1]*8)+' L'+n(elbow[0]-en[0]*2)+' '+n(elbow[1]-en[1]*2),INK,1.2,' opacity=".55"');
    return '<g class="character-arm">'+art+'</g>';
  }

  function hand(c, values, left) {
    const x=values[2][0], y=values[2][1], angle=values[3], kind=values[4];
    let d, details;
    if(kind==='open') {
      d='M-5 2 L-7 -7 Q-13 -10 -15 -16 Q-16 -19 -13 -19 Q-10 -18 -6 -13 L-8 -28 Q-9 -33 -6 -33 Q-3 -33 -3 -28 L-1 -19 L-1 -35 Q-1 -39 2 -38 Q4 -38 4 -34 L5 -20 L7 -32 Q8 -36 10 -34 Q12 -33 11 -29 L10 -18 L13 -27 Q15 -30 17 -28 Q18 -26 16 -22 L13 -9 Q11 -3 6 2 Z';
      details='M-6 -13 Q-2 -15 2 -11 M5 -20 L5 -12 M10 -18 L9 -11 M-3 -24 L-2 -15 M-4 -5 Q1 -8 7 -5';
    } else if(kind==='point') {
      d='M-5 2 L-7 -8 Q-13 -11 -12 -16 Q-11 -19 -8 -17 L-3 -13 L-4 -33 Q-4 -37 -1 -37 Q2 -37 2 -33 L3 -18 Q6 -23 9 -20 L10 -16 Q14 -19 15 -14 L14 -7 Q13 -2 7 2 Z';
      details='M3 -18 L4 -9 M9 -18 L9 -9 M-3 -13 Q2 -13 4 -8 M-3 -4 L7 -5';
    } else if(kind==='forehead') {
      d='M-5 2 L-8 -9 Q-13 -13 -12 -18 Q-11 -21 -8 -18 L-4 -14 L-6 -31 Q-6 -35 -3 -35 Q0 -35 0 -31 L2 -20 L2 -36 Q3 -40 5 -38 Q7 -38 7 -34 L8 -21 L11 -33 Q12 -37 15 -35 Q17 -34 15 -29 L13 -19 L17 -27 Q19 -31 21 -28 Q22 -26 20 -22 L15 -8 Q12 -2 6 2 Z';
      details='M-4 -14 Q1 -17 6 -11 M2 -20 L3 -13 M8 -21 L8 -13 M13 -19 L12 -12 M-2 -5 Q3 -8 9 -6';
    } else if(kind==='steady') {
      d='M-6 2 L-7 -8 L-12 -15 Q-14 -19 -11 -20 Q-9 -20 -5 -14 L-6 -29 Q-6 -33 -3 -33 Q0 -33 0 -29 L1 -19 L1 -33 Q1 -37 4 -36 Q6 -36 6 -32 L7 -19 L8 -30 Q9 -34 11 -32 Q13 -32 12 -28 L11 -17 L14 -25 Q16 -29 18 -26 Q19 -25 17 -21 L13 -8 Q11 -2 6 2 Z';
      details='M-5 -14 Q0 -16 4 -11 M1 -19 L2 -12 M7 -19 L7 -11 M11 -17 L10 -10 M-2 -5 Q3 -7 8 -5';
    } else if(kind==='soft') {
      d='M-5 2 L-7 -8 Q-12 -11 -12 -16 Q-11 -19 -8 -17 L-4 -12 L-4 -27 Q-4 -31 -1 -31 Q1 -30 1 -26 L2 -17 L3 -29 Q4 -33 6 -31 Q8 -31 7 -27 L7 -16 L10 -26 Q12 -30 14 -27 L13 -21 L11 -12 L15 -18 Q18 -20 18 -16 L14 -7 Q12 -1 6 2 Z';
      details='M-4 -12 Q1 -14 5 -9 M2 -17 L3 -10 M7 -16 L7 -9 M-3 -4 Q2 -6 8 -4';
    } else {
      d='M-5 1 L-7 -8 L-7 -17 Q-7 -22 -4 -21 L-2 -14 L-2 -24 Q-2 -28 1 -27 Q3 -26 3 -22 L4 -14 L5 -22 Q6 -26 8 -24 Q10 -23 9 -19 L9 -12 L11 -18 Q13 -21 15 -18 L14 -12 L11 -4 L6 2 Z';
      details='M-4 -11 Q0 -14 4 -10 M3 -20 L4 -11 M9 -17 L9 -10 M-2 -4 L7 -4';
    }
    return '<g class="gesture-hand hand-'+(left?'left':'right')+'" transform="translate('+x+' '+y+') rotate('+angle+') scale('+(left?-1:1)+' 1)"><g class="gesture-motion">'+path(d,c.skin,' stroke="'+INK+'" stroke-width="1.5" stroke-linejoin="round"')+line(details,c.shade,1.1)+'</g></g>';
  }

  function eye(c, pose, cx, right) {
    const y=101+(c.eye==='sharp'?-1:0), half=c.eye==='round'?10.5:c.eye==='wide'?11:10, high=c.eye==='heavy'?4:6;
    if(pose==='happy') return line('M'+(cx-half)+' '+(y+1)+' Q'+cx+' '+(y-9)+' '+(cx+half)+' '+(y+1),INK,2.2)+line('M'+(cx-half)+' '+(y+2)+' L'+(cx-half-2)+' '+(y-1),INK,1.5);
    const wide=pose==='surprised', sleepy=pose==='thinking', top=wide?10:sleepy?high-1:pose==='worried'?high+1:pose==='firm'?high*.62:pose==='hopeful'?high+1.6:pose==='talking'?high+.7:high;
    const lower=wide?8:pose==='firm'?2.6:pose==='hopeful'?6:c.eye==='round'?6:4;
    const d='M'+(cx-half)+' '+y+' Q'+cx+' '+(y-top*1.65)+' '+(cx+half)+' '+y+' Q'+cx+' '+(y+lower*1.7)+' '+(cx-half)+' '+y+' Z';
    let art=path(d,'#fff8e9',' stroke="'+INK+'" stroke-width="1.3"');
    const pupilX=cx+(sleepy?-2:pose==='worried'?1:pose==='talking'?.5:0), ry=wide?7.7:pose==='firm'?5.1:pose==='hopeful'?7:6.4;
    art+='<ellipse cx="'+pupilX+'" cy="'+(y+.2)+'" rx="'+(wide?5.6:5)+'" ry="'+ry+'" fill="'+c.iris+'"/>';
    art+='<ellipse cx="'+pupilX+'" cy="'+(y-.3)+'" rx="2.5" ry="'+(wide?5.2:4.9)+'" fill="'+INK+'"/>';
    art+='<ellipse cx="'+(pupilX-1.7)+'" cy="'+(y-3)+'" rx="1.8" ry="2.1" fill="#fffdf3"/><ellipse cx="'+(pupilX+2)+'" cy="'+(y+2.5)+'" rx=".8" ry="1" fill="#fffdf3"/>';
    art+=line('M'+(cx-half-1)+' '+y+' Q'+cx+' '+(y-top*1.65)+' '+(cx+half+1)+' '+y,INK,c.eye==='heavy'?2.8:2.1);
    art+=line('M'+(cx-half+1)+' '+(y-top-4)+' Q'+cx+' '+(y-top-7)+' '+(cx+half-1)+' '+(y-top-3),c.shade,1.1,' opacity=".8"');
    if(c.eye==='round'||c.id==='akari')art+=line('M'+(right?cx+half:cx-half)+' '+(y-1)+' l'+(right?3:-3)+' -3',INK,1.5);
    return art;
  }
  function brows(c, pose) {
    const x1=120-c.eyeSep,x2=120+c.eyeSep;
    let left,right;
    if(pose==='worried'){left=[89,86,95];right=[95,86,89];}
    else if(pose==='firm'){left=[85,87,91];right=[91,87,85];}
    else if(pose==='surprised'){left=[83,78,81];right=[81,78,83];}
    else if(pose==='thinking'){left=[88,85,88];right=[84,81,84];}
    else if(pose==='happy'){left=[87,82,86];right=[86,82,87];}
    else if(pose==='hopeful'){left=[87,82,86];right=[86,82,87];}
    else if(pose==='talking'){left=[86,81,84];right=[85,82,87];}
    else{left=[88,85,87];right=[87,85,88];}
    return '<g class="character-brows">'+line('M'+(x1-10)+' '+left[0]+' Q'+x1+' '+left[1]+' '+(x1+9)+' '+left[2],c.hair,c.brow)+line('M'+(x2-9)+' '+right[0]+' Q'+x2+' '+right[1]+' '+(x2+10)+' '+right[2],c.hair,c.brow)+'</g>';
  }
  function mouth(c, pose) {
    let art='';
    if(pose==='talking')art=path('M111 129 Q120 125 130 129 Q129 140 121 141 Q114 140 111 129 Z','#754b4b',' stroke="'+INK+'" stroke-width="1.4"')+path('M113 130 Q120 128 128 130 L127 133 L114 133 Z','#fff7e3','')+path('M116 137 Q121 134 126 137 Q121 142 116 137 Z','#c7847f','');
    else if(pose==='happy')art=path('M107 127 Q120 133 134 126 Q130 145 121 145 Q112 143 107 127 Z','#754b4b',' stroke="'+INK+'" stroke-width="1.5"')+path('M110 129 Q121 133 131 129 L128 135 Q121 137 113 134 Z','#fff8e3','')+path('M115 141 Q121 136 128 140 Q121 146 115 141 Z','#c98680','');
    else if(pose==='surprised')art=path('M116 128 Q122 124 126 130 Q129 138 123 141 Q117 142 115 136 Q113 131 116 128 Z','#76504b',' stroke="'+INK+'" stroke-width="1.3"')+line('M118 130 Q121 128 124 130','#c99a8c',1.2);
    else if(pose==='worried')art=line('M112 134 Q120 126 129 132',INK,1.6)+line('M116 138 Q121 135 126 137',c.shade,1.1);
    else if(pose==='thinking')art=line('M115 132 Q121 133 126 130',INK,1.6)+line('M118 136 L124 136',c.shade,1.1);
    else if(pose==='firm')art=line('M111 131 Q120 132 130 130',INK,1.7)+line('M116 136 Q122 138 127 135',c.shade,1.1);
    else if(pose==='hopeful')art=line('M110 129 Q120 140 131 128',INK,1.7)+line('M116 137 Q122 140 127 136',c.shade,1.1);
    else art=line('M112 130 Q121 136 130 129',INK,1.5)+line('M117 136 L124 136',c.shade,1);
    return '<g class="character-mouth">'+art+'</g>';
  }
  function head(c, pose) {
    let art=path('M84 94 Q73 89 77 106 Q78 117 88 116 L91 103 Z M155 94 Q167 88 165 104 Q165 116 154 117 L150 103 Z',c.skin,' stroke="'+INK+'" stroke-width="1.7"')+line('M81 99 Q77 102 83 109 M160 99 Q165 102 158 110',c.shade,1.3);
    art+=path(c.face,c.skin,' stroke="'+INK+'" stroke-width="1.9"');
    art+=path('M86 82 Q85 103 93 120 Q102 140 121 151 Q95 141 87 118 Z',c.shade,' opacity=".23"');
    art+=path('M94 117 Q103 111 110 117 Q104 124 95 122 Z M134 117 Q142 112 149 118 Q145 125 135 122 Z','#dc8a7e',' opacity="'+(c.id==='iona'?'.2':'.24')+'"');
    art+='<g class="character-eyes">'+eye(c,pose,120-c.eyeSep,false)+eye(c,pose,120+c.eyeSep,true)+'</g>';
    art+=brows(c,pose)+line('M121 107 L118 118 Q121 121 125 118',c.shade,1.45)+line('M119 119 L121 120',INK,.95)+mouth(c,pose);
    if(c.id==='sora')art+=path('M94 115 h1 M99 117 h1 M104 114 h1 M137 115 h1 M143 117 h1 M148 114 h1','none',' stroke="#90634c" stroke-width="1.7" stroke-linecap="round"');
    if(c.id==='ren')art+=line('M107 143 L110 145 M115 147 L117 148 M128 147 L130 145 M137 141 L139 139',c.shade,1.2);
    if(c.id==='yuki')art+= '<g class="character-glasses">'+path('M89 93 Q102 90 114 94 L113 107 Q102 112 91 107 Z M127 94 Q140 90 152 93 L150 107 Q139 112 128 107 Z','none',' stroke="'+INK+'" stroke-width="1.7"')+line('M114 97 Q120 94 127 97 M89 96 L81 92 M152 96 L159 92',INK,1.5)+line('M94 95 L98 95 M131 95 L135 94','#fff5df',1.3)+'</g>';
    art+=hairFront(c);
    if(c.id==='mio')art+=path('M81 117 Q75 127 80 132 Q86 131 85 126 Z M159 117 Q153 128 158 132 Q164 130 163 125 Z','#e6bd63',' stroke="'+INK+'" stroke-width="1.3"');
    return '<g class="character-head" transform="rotate('+GESTURES[pose].tilt+' 120 146)"><g class="head-motion">'+art+'</g></g>';
  }

  function render(id, pose, side, instance) {
    const key=typeof id==='string'?id.toLowerCase():'';
    const c=Object.prototype.hasOwnProperty.call(BY_ID,key)?BY_ID[key]:BY_ID.akari;
    const p=POSES.indexOf(pose)!==-1?pose:'neutral';
    const token=(typeof instance==='string'||typeof instance==='number'?String(instance):'cast').replace(/[^a-zA-Z0-9]/g,'').slice(0,48)||'cast';
    const uid='aap'+token+c.id+(++serial), label=c.name+' — '+EMOTIONS[p];
    const g=GESTURES[p], mirror=side==='right'?'translate(240 0) scale(-1 1)':'';
    const back='<g transform="rotate('+g.tilt+' 120 146)">'+hairBack(c)+'</g>';
    const body='<g'+(mirror?' transform="'+mirror+'"':'')+'>'+torso(c,p)+arm(c,g.left)+arm(c,g.right)+'</g>';
    const hands='<g'+(mirror?' transform="'+mirror+'"':'')+'>'+hand(c,g.left,true)+hand(c,g.right,false)+'</g>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 360" role="img" aria-label="'+e(label)+'" aria-labelledby="'+uid+'Title" class="story-character cast-'+c.id+' pose-'+p+'" data-character="'+c.id+'" data-pose="'+p+'" stroke-linecap="round" stroke-linejoin="round"><title id="'+uid+'Title">'+e(label)+'. '+e(c.detail)+'.</title>'+back+body+head(c,p)+hands+'</svg>';
  }

  const api=Object.freeze({render:render,cast:CAST,byId:BY_ID,poses:POSES});
  root.AAPCharacters=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
