
import React, { useState, useRef } from 'react';
import { VisaApplication, ServiceConfig, ServiceCategory } from '../types';
import { lookupFlightDetails } from '../services/geminiService';
import { normalizeFlight } from '../services/dataStore';

interface ApplicationFormProps {
  service: ServiceConfig;
  onSave: (app: VisaApplication) => void;
  onCancel: () => void;
  initialData?: VisaApplication;
}

const VISA_TYPES = [
  'Arrival (VOA)', 'TR (Tourist)', 'ED (Education)', 'DTV (Destination Thailand)', 
  'Non-LA', 'Non-B (Business)', 'Non-O (Family)', 'Non-O-A (Retirement)', 'Special'
];

const Label: React.FC<React.PropsWithChildren<{ required?: boolean }>> = ({ children, required }) => (
  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2 ml-1">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const ErrorMsg: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return <p className="mt-1.5 ml-1 text-[10px] font-bold text-rose-500 uppercase tracking-wider animate-fadeIn">{message}</p>;
};

const ApplicationForm: React.FC<ApplicationFormProps> = ({ service, onSave, onCancel, initialData }) => {
  const isEasyPass = service.category === ServiceCategory.EASY_PASS;
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const lastLookupRef = useRef<string>("");

  const [formData, setFormData] = useState<Partial<VisaApplication>>(initialData || {
    clientName: '',
    passportNumber: '',
    nationality: '',
    status: 'Pending',
    notes: '',
    price: '',
    costPrice: '0',
    agencyCommission: 0,
    flightNo: '',
    airline: '',
    embarkation: '',
    agentName: '',
    visaType: 'Arrival (VOA)',
    letterType: '',
    address: '',
    origin: '',
    destination: '',
    departCountry: '',
    landedCountry: 'Thailand',
    arrivalDate: '',
    arrivalTime: '',
    office: service.offices[0] || 'ALL',
    paxCount: 1
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.clientName?.trim()) newErrors.clientName = "Client identity required";
    if (!formData.nationality?.trim()) newErrors.nationality = "Nationality required";
    if (!isEasyPass && !formData.passportNumber?.trim()) newErrors.passportNumber = "Passport number required";
    if (isEasyPass && !formData.flightNo?.trim()) newErrors.flightNo = "Flight Number required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Refined Flight Verification:
   * 1. Only triggers if the flight number is new.
   * 2. Intelligently updates status if flight is landed.
   * 3. Prevents 'TBA' overwrites by prioritizing real data.
   */
  const handleFlightLookup = async (force: boolean = false) => {
    const fNo = normalizeFlight(formData.flightNo);
    if (!fNo || fNo.trim().length < 2) return;
    
    // Skip if already looked up unless forced
    if (!force && fNo === lastLookupRef.current) return;

    setIsLookingUp(true);
    setLookupFeedback(null);
    lastLookupRef.current = fNo;

    try {
      const result = await lookupFlightDetails(fNo, formData.arrivalDate);
      if (result && result.data) {
        const d = result.data;
        const flightStatus = d.status?.toLowerCase() || '';
        const isLanded = ['landed', 'arrived', 'at gate'].some(s => flightStatus.includes(s));
        
        setFormData(prev => ({ 
          ...prev, 
          airline: (d.airline && d.airline !== 'TBA') ? d.airline : prev.airline,
          origin: (d.origin && d.origin !== 'TBA') ? d.origin : prev.origin,
          destination: (d.destination && d.destination !== 'TBA') ? d.destination : prev.destination,
          departCountry: (d.departCountry && d.departCountry !== 'TBA') ? d.departCountry : prev.departCountry,
          arrivalDate: (d.arrivalDate && d.arrivalDate !== 'TBA') ? d.arrivalDate : prev.arrivalDate,
          arrivalTime: (d.arrivalTime && d.arrivalTime !== 'TBA') ? d.arrivalTime : prev.arrivalTime,
          status: isLanded ? 'Completed' : prev.status,
          completedAt: isLanded ? new Date().toISOString() : prev.completedAt
        }));

        setLookupFeedback({ 
          type: 'success', 
          message: isLanded 
            ? `Verified: ${d.airline} Landed. Record Finalized.` 
            : `Verified: ${d.airline} Telemetry Active.` 
        });
        setErrors(prev => ({ ...prev, flightNo: "" }));
      } else {
        setLookupFeedback({ type: 'error', message: "Aviation Telemetry Unavailable (Incomplete Source Data)" });
      }
    } catch (err) {
      setLookupFeedback({ type: 'error', message: "Satellite Uplink Error" });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      ...formData as VisaApplication,
      flightNo: normalizeFlight(formData.flightNo),
      id: initialData?.id || Date.now().toString(),
      serviceCategory: service.category,
      subService: service.subService,
      createdAt: initialData?.createdAt || new Date().toISOString(),
    });
  };

  const getInputClasses = (field: string) => {
    const base = "w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none transition-all text-sm";
    const status = errors[field] ? "border-rose-400 focus:border-rose-500" : "border-slate-100 dark:border-slate-800 focus:border-blue-500";
    return `${base} ${status}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-5xl bg-white dark:bg-slate-900 sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-slideUp">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{service.title}</h3>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-rose-600 transition-all">✕</button>
        </div>
        <form id="visa-app-form" onSubmit={handleSubmit} className="p-6 md:p-10 space-y-10 overflow-y-auto grow custom-scrollbar">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Label required>Flight Number</Label>
              <div className="flex gap-2">
                <input 
                  className={`${getInputClasses('flightNo')} font-mono uppercase`} 
                  value={formData.flightNo} 
                  onChange={(e) => setFormData({ ...formData, flightNo: e.target.value.toUpperCase() })} 
                  onBlur={() => handleFlightLookup(false)}
                  placeholder="e.g. EK384" 
                />
                <button type="button" onClick={() => handleFlightLookup(true)} disabled={isLookingUp} className="px-6 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase min-w-[140px] transition-all hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50">
                  {isLookingUp ? 'Searching...' : 'Manual Verify'}
                </button>
              </div>
              <ErrorMsg message={errors.flightNo} />
              {lookupFeedback && <div className={`mt-2 text-[10px] font-black px-4 py-2 rounded-xl border ${lookupFeedback.type === 'error' ? 'text-rose-600 border-rose-100 bg-rose-50' : 'text-emerald-600 border-emerald-100 bg-emerald-50'}`}>{lookupFeedback.message}</div>}
            </div>
            <div>
              <Label required>Client Full Name</Label>
              <input className={getInputClasses('clientName')} value={formData.clientName} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })} />
              <ErrorMsg message={errors.clientName} />
            </div>
            <div>
              <Label required>Nationality</Label>
              <input className={getInputClasses('nationality')} value={formData.nationality} onChange={(e) => setFormData({ ...formData, nationality: e.target.value })} />
              <ErrorMsg message={errors.nationality} />
            </div>
            <div>
              <Label>Passport Number</Label>
              <input className={`${getInputClasses('passportNumber')} font-mono`} value={formData.passportNumber} onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label>Visa Category</Label>
              <select className={getInputClasses('visaType')} value={formData.visaType} onChange={(e) => setFormData({ ...formData, visaType: e.target.value })}>
                {VISA_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <Label>Arrival Date</Label>
              <input type="date" className={getInputClasses('arrivalDate')} value={formData.arrivalDate} onChange={(e) => setFormData({ ...formData, arrivalDate: e.target.value })} />
            </div>
            <div>
              <Label>Arrival Time</Label>
              <input type="time" className={getInputClasses('arrivalTime')} value={formData.arrivalTime} onChange={(e) => setFormData({ ...formData, arrivalTime: e.target.value })} />
            </div>
            <div>
              <Label>Airline</Label>
              <input className={getInputClasses('airline')} value={formData.airline || ''} onChange={(e) => setFormData({ ...formData, airline: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Origin (IATA)</Label>
                <input className={`${getInputClasses('origin')} font-mono uppercase`} value={formData.origin || ''} onChange={(e) => setFormData({ ...formData, origin: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <Label>Dest (IATA)</Label>
                <input className={`${getInputClasses('destination')} font-mono uppercase`} value={formData.destination || ''} onChange={(e) => setFormData({ ...formData, destination: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div>
              <Label>Departure Country</Label>
              <input className={getInputClasses('departCountry')} value={formData.departCountry || ''} onChange={(e) => setFormData({ ...formData, departCountry: e.target.value })} />
            </div>
            <div>
              <Label>Landing Country</Label>
              <input className={getInputClasses('landedCountry')} value={formData.landedCountry || ''} onChange={(e) => setFormData({ ...formData, landedCountry: e.target.value })} />
            </div>
            <div>
              <Label>Pax Count</Label>
              <input type="number" className={getInputClasses('paxCount')} value={formData.paxCount || 1} onChange={(e) => setFormData({ ...formData, paxCount: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <Label>Status</Label>
              <select className={getInputClasses('status')} value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </section>
        </form>
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 py-4 font-bold text-slate-500 border rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancel</button>
          <button form="visa-app-form" type="submit" className="flex-1 py-4 font-bold bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all">Save Record</button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationForm;
