const fs = require('fs');
let c = fs.readFileSync('src/components/LoginScreen.tsx', 'utf-8');

const target = `{/* LEFT SECTION - 70% Ambient Branding & Enterprise Visual Identity */}
      <div className="w-full lg:w-[70%] bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden min-h-[400px] lg:min-h-screen">
        {/* Decorative Grid Lines & Subtle Ambient Glow */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />`;

const replacement = `{/* LEFT SECTION - 70% Ambient Branding & Enterprise Visual Identity */}
      <div 
        className="w-full lg:w-[70%] text-white p-8 lg:p-16 flex flex-col justify-between relative overflow-hidden min-h-[400px] lg:min-h-screen"
        style={{
          backgroundImage: 'url("https://github.com/MarceloGomes-Dev/Miotica/blob/main/fundo.jpg?raw=true")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Dark overlay filter */}
        <div className="absolute inset-0 bg-black/70 z-0 pointer-events-none" />`;

if (c.includes(target)) {
  c = c.replace(target, replacement);
  fs.writeFileSync('src/components/LoginScreen.tsx', c);
  console.log('LoginScreen updated.');
} else {
  console.log('Target not found in LoginScreen.');
}
