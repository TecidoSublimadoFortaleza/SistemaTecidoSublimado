import React, { useState } from 'react';
import { Address } from '../../server/types/client';
import { MapPin, Search, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface AddressFormProps {
  value?: Address;
  address?: Address;
  onChange: (updatedAddress: Address) => void;
  readOnly?: boolean;
}

const defaultAddress: Address = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
};

export const AddressForm: React.FC<AddressFormProps> = ({
  value,
  address,
  onChange,
  readOnly = false,
}) => {
  const currentAddress = value || address || defaultAddress;
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepStatus, setCepStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  // Apply CEP mask 00000-000
  const formatCep = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const masked = formatCep(rawVal);
    const updated = { ...currentAddress, cep: masked };
    onChange(updated);

    const cleanCep = masked.replace(/\D/g, '');

    if (cleanCep.length === 8) {
      setIsLoadingCep(true);
      setCepStatus({ type: null, message: '' });

      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();

        if (data.erro) {
          setCepStatus({
            type: 'error',
            message: 'CEP não encontrado. Por favor, preencha o endereço manualmente.',
          });
        } else {
          onChange({
            ...updated,
            logradouro: data.logradouro || updated.logradouro,
            bairro: data.bairro || updated.bairro,
            cidade: data.localidade || updated.cidade,
            estado: data.uf || updated.estado,
          });
          setCepStatus({
            type: 'success',
            message: 'Endereço localizado e preenchido automaticamente via ViaCEP!',
          });
        }
      } catch {
        setCepStatus({
          type: 'error',
          message: 'Falha na consulta do CEP. Insira os dados manualmente.',
        });
      } finally {
        setIsLoadingCep(false);
      }
    } else {
      setCepStatus({ type: null, message: '' });
    }
  };

  const handleChangeField = (field: keyof Address, val: string) => {
    onChange({ ...currentAddress, [field]: val });
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
        <MapPin className="w-5 h-5 text-blue-600" />
        <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
          Endereço do Cliente
        </h3>
        <span className="text-sm text-slate-500 font-medium ml-auto">
          Busca automática por CEP
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* CEP */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            CEP <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={currentAddress.cep || ''}
              onChange={handleCepChange}
              disabled={readOnly}
              placeholder="00000-000"
              maxLength={9}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all pr-9"
            />
            <div className="absolute right-2.5 top-2.5 text-slate-400">
              {isLoadingCep ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>

        {/* LOGRADOURO / RUA */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-bold text-slate-700 mb-1">
            Logradouro / Rua <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={currentAddress.logradouro || ''}
            onChange={(e) => handleChangeField('logradouro', e.target.value)}
            disabled={readOnly}
            placeholder="Digite o endereço..."
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
          />
        </div>

        {/* NÚMERO */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            Número <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={currentAddress.numero || ''}
            onChange={(e) => handleChangeField('numero', e.target.value)}
            disabled={readOnly}
            placeholder="Ex: 1020, S/N"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
          />
        </div>

        {/* COMPLEMENTO */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            Complemento
          </label>
          <input
            type="text"
            value={currentAddress.complemento || ''}
            onChange={(e) => handleChangeField('complemento', e.target.value)}
            disabled={readOnly}
            placeholder="Ex: Apt 42, Bloco B"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
          />
        </div>

        {/* BAIRRO */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            Bairro <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={currentAddress.bairro || ''}
            onChange={(e) => handleChangeField('bairro', e.target.value)}
            disabled={readOnly}
            placeholder="Ex: Centro"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
          />
        </div>

        {/* CIDADE */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            Cidade <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={currentAddress.cidade || ''}
            onChange={(e) => handleChangeField('cidade', e.target.value)}
            disabled={readOnly}
            placeholder="Ex: Fortaleza"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
          />
        </div>

        {/* ESTADO */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">
            UF / Estado <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={currentAddress.estado || ''}
            onChange={(e) => handleChangeField('estado', e.target.value.toUpperCase().slice(0, 2))}
            disabled={readOnly}
            placeholder="Ex: CE"
            maxLength={2}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 uppercase placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* CEP STATUS FEEDBACK */}
      {cepStatus.message && (
        <div
          className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${
            cepStatus.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}
        >
          {cepStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span>{cepStatus.message}</span>
        </div>
      )}
    </div>
  );
};
