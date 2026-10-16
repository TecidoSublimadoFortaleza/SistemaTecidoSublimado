const fs = require('fs');
let c = fs.readFileSync('src/components/LoginScreen.tsx', 'utf-8');

// 1. Remove "Ambiente Seguro TLS 1.3"
const tlsBadge = `          <span className="text-xs font-semibold text-blue-100 bg-blue-900/40 px-3 py-1.5 rounded-full border border-blue-400/30">
            Ambiente Seguro TLS 1.3
          </span>`;
c = c.replace(tlsBadge, '');

// 2. Remove "Gestão Integrada de Indústria Têxtil & Sublimação"
const gestaoBadge = `            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-200 bg-blue-900/50 px-3 py-1 rounded-full border border-blue-400/30 mb-6">
              <Sparkles className="w-4 h-4 text-amber-300" />
              Gestão Integrada de Indústria Têxtil & Sublimação
            </div>`;
c = c.replace(gestaoBadge, '');

// 3. Add background image to 30% panel
const rightSectionOrig = `{/* RIGHT SECTION - 30% Sleek Enterprise Login Panel */}
      <div className="w-full lg:w-[30%] bg-white p-8 lg:p-12 flex flex-col justify-between shadow-2xl z-20 border-l border-slate-200">
        <div>
          {/* Logo Branding Header */}`;

const rightSectionNew = `{/* RIGHT SECTION - 30% Sleek Enterprise Login Panel */}
      <div 
        className="w-full lg:w-[30%] p-8 lg:p-12 flex flex-col justify-between shadow-2xl z-20 border-l border-slate-200 relative overflow-hidden"
        style={{
          backgroundImage: 'url("https://i.pinimg.com/736x/d5/d5/19/d5d51952764f725ef6f9065d2d159b6c.jpg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-white/85 z-0 pointer-events-none" />
        <div className="relative z-10 flex flex-col h-full justify-between">
          <div>
          {/* Logo Branding Header */}`;

c = c.replace(rightSectionOrig, rightSectionNew);

// Also need to close the extra div we added for z-10 layout. The original structure ends with:
//         <div className="mt-8 pt-6 border-t border-slate-100 text-center">
//           <p className="text-[11px] font-medium text-slate-400 flex items-center justify-center gap-1">
//             <ShieldCheck className="w-4 h-4 text-emerald-600" />
//             Sessão encriptada via JWT Refresh Auth
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// };
const endOrig = `        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[11px] font-medium text-slate-400 flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Sessão encriptada via JWT Refresh Auth
          </p>
        </div>
      </div>
    </div>
  );
};`;

const endNew = `        <div className="mt-8 pt-6 border-t border-slate-300/50 text-center">
          <p className="text-[11px] font-medium text-slate-600 flex items-center justify-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Sessão encriptada via JWT Refresh Auth
          </p>
        </div>
        </div>
      </div>
    </div>
  );
};`;

c = c.replace(endOrig, endNew);

fs.writeFileSync('src/components/LoginScreen.tsx', c);
