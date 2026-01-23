
import React, { useState } from 'react';
import { VisaApplication, ServiceConfig, ServiceCategory } from '../types';

interface ApplicationFormProps {
  service: ServiceConfig;
  onSave: (app: VisaApplication) => void;
  onCancel: () => void;
  initialData?: VisaApplication;
}

const Label: React.FC<React.PropsWithChildren<{ required?: boolean }>> = ({ children, required }) => (
  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const ApplicationForm: React.FC<ApplicationFormProps> = ({ service, onSave, onCancel, initialData }) => {
  const isEasyPass = service.category === ServiceCategory.EASY_PASS;
  const isVisaExt = service.category === ServiceCategory.VISA_EXTENSION;
  const isLetter = service.category === ServiceCategory.LETTER;
  const isTM30 = service.category === ServiceCategory.TM30;
  const isTicketing = service.category === ServiceCategory.TICKETING;

  const [showPassport, setShowPassport] = useState(false);
  const [formData, setFormData] = useState<Partial<VisaApplication>>(initialData || {
    clientName: '',
    passportNumber: '',
    nationality: '',
    status: 'Pending',
    notes: '',
    price: '',
    costPrice: '0',
    flightNo: '',
    embarkation: '',
    agentName: '',
    visaType: '',
    letterType: '',
    address: '',
    origin: '',
    destination: '',
    arrivalDate: '',
    arrivalTime: '',
    office: service.offices[0] || 'ALL',
    paxCount: 1
  });

  const [isAgent, setIsAgent] = useState(!!initialData?.agentName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData as VisaApplication,
      id: initialData?.id || Date.now().toString(),
      serviceCategory: service.category,
      subService: service.subService,
      agentName: isAgent && isVisaExt ? formData.agentName : '',
      createdAt: initialData?.createdAt || new Date().toISOString(),
    });
  };

  const inputClasses = "w-full px-4 py-3 rounded-xl border-2 border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-600 outline-none transition-all text-sm shadow-sm";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl lg:max-w-4xl bg-white dark:bg-slate-900 sm:rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden animate-slideUp">
        
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400 shadow-inner">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-600/60 dark:text-blue-400/60 uppercase tracking-[0.2em]">{service.category}</p>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {initialData ? 'Update Core Record' : `New ${service.title} Entry`}
              </h3>
            </div>
          </div>
          <button onClick={onCancel} className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form id="visa-app-form" onSubmit={handleSubmit} className="p-8 lg:p-10 space-y-10 overflow-y-auto grow custom-scrollbar bg-white dark:bg-slate-900">
          {/* Identity Section */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
               <div className="h-1 w-12 bg-blue-600 rounded-full"></div>
               <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Security & Client ID</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="md:col-span-2 lg:col-span-1">
                <Label required>Client Display Name</Label>
                <input required className={inputClasses} value={formData.clientName} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })} placeholder="Legal Identity Name" />
              </div>
              <div className="relative">
                <Label required>Passport Reference</Label>
                <div className="relative group">
                  <input 
                    required 
                    type={showPassport ? "text" : "password"}
                    className={`${inputClasses} font-mono uppercase tracking-widest pr-12`} 
                    value={formData.passportNumber} 
                    onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })} 
                    placeholder="Reference Number" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassport(!showPassport)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {showPassport ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L1 1m11 11l9 9" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>
              <div className="lg:col-span-1">
                <Label required>Nationality</Label>
                <input required className={inputClasses} value={formData.nationality} onChange={(e) => setFormData({ ...formData, nationality: e.target.value })} placeholder="Origin Country" />
              </div>
              <div className="lg:col-span-1">
                <Label required>People Count (Pax)</Label>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  className={inputClasses} 
                  value={formData.paxCount} 
                  onChange={(e) => setFormData({ ...formData, paxCount: parseInt(e.target.value) || 1 })} 
                />
              </div>
            </div>
          </section>

          {/* Service Logistics */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
               <div className="h-1 w-12 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
               <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Deployment Logistics</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {isEasyPass && (
                <>
                  <div>
                    <Label required>Flight No.</Label>
                    <input required className={`${inputClasses} font-mono uppercase`} value={formData.flightNo} onChange={(e) => setFormData({ ...formData, flightNo: e.target.value })} placeholder="e.g. VZ121" />
                  </div>
                  <div>
                    <Label required>Arrival Date</Label>
                    <input required className={inputClasses} value={formData.arrivalDate} onChange={(e) => setFormData({ ...formData, arrivalDate: e.target.value })} placeholder="e.g. Mar 12" />
                  </div>
                  <div>
                    <Label required>Estimated Time</Label>
                    <input required className={inputClasses} value={formData.arrivalTime} onChange={(e) => setFormData({ ...formData, arrivalTime: e.target.value })} placeholder="HH:MM" />
                  </div>
                </>
              )}
              {isTicketing && (
                <>
                  <div className="lg:col-span-1"><Label required>Origin Code</Label><input required className={inputClasses} value={formData.origin} onChange={(e) => setFormData({ ...formData, origin: e.target.value })} /></div>
                  <div className="lg:col-span-1"><Label required>Destination Code</Label><input required className={inputClasses} value={formData.destination} onChange={(e) => setFormData({ ...formData, destination: e.target.value })} /></div>
                </>
              )}
              {isLetter && (
                <div className="md:col-span-3">
                  <Label required>Document Classification</Label>
                  <select required className={inputClasses} value={formData.letterType} onChange={(e) => setFormData({ ...formData, letterType: e.target.value })}>
                    <option value="">Select Classification</option>
                    <option>Standard Extension Support</option>
                    <option>Residence Certification</option>
                    <option>Identity Verification</option>
                  </select>
                </div>
              )}
            </div>
          </section>

          {/* Workflow & Finance */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
               <div className="h-1 w-12 bg-emerald-600 rounded-full"></div>
               <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Financial Audit</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div>
                <Label required>Billing Revenue</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">฿</span>
                  <input required className={`${inputClasses} pl-8 font-mono font-bold text-emerald-600`} value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div>
                <Label required>Supply Cost</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">฿</span>
                  <input required className={`${inputClasses} pl-8 font-mono`} value={formData.costPrice} onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div className="lg:col-span-2">
                <Label>Workflow Stage</Label>
                <select className={`${inputClasses} font-black uppercase text-xs tracking-widest`} value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}>
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-4 pb-8">
            <Label>Intelligence Notes</Label>
            <textarea 
              className={`${inputClasses} h-40 resize-none custom-scrollbar shadow-inner bg-slate-50/30`} 
              value={formData.notes} 
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
              placeholder="Internal case history and requirement logs..." 
            />
          </section>
        </form>

        <div className="px-8 py-8 border-t border-slate-100 dark:border-slate-800 flex gap-4 bg-slate-50 dark:bg-slate-800/20 backdrop-blur-xl">
          <button type="button" onClick={onCancel} className="flex-1 py-4 font-black text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all uppercase text-xs tracking-[0.2em] border-2 border-slate-200 dark:border-slate-700 rounded-2xl">Abort</button>
          <button form="visa-app-form" type="submit" className="flex-1 py-4 font-black bg-blue-600 text-white rounded-2xl shadow-2xl shadow-blue-500/40 hover:bg-blue-700 transition-all uppercase text-xs tracking-[0.2em]">Synchronize Record</button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationForm;
