import { create } from 'zustand';
import { supabase } from '../utils/supabaseClient';
import { useAuthStore } from './useAuthStore';

export interface TourStep {
  targetId: string; // DOM element ID to highlight
  title: string;
  description: string;
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  route: string; // Which page the step belongs to
}

interface TourState {
  active: boolean;
  stepIndex: number;
  steps: TourStep[];
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
  setStepsForRoute: (pathname: string) => void;
}

const ALL_STEPS: TourStep[] = [
  // Dashboard Steps
  {
    targetId: 'tour-sidebar-menu',
    title: 'Menú de Navegación',
    description: 'Aquí puedes moverte entre todas las secciones de KIOSNET: POS, Inventario, Caja, Historial y Reportes.',
    placement: 'right',
    route: '/dashboard'
  },
  {
    targetId: 'tour-dashboard-stats',
    title: 'Estadísticas Rápidas',
    description: 'Monitorea tus ventas del día, la cantidad de productos en inventario, productos con bajo stock y tus clientes en tiempo real.',
    placement: 'bottom',
    route: '/dashboard'
  },
  {
    targetId: 'tour-dashboard-license',
    title: 'Estado del Plan',
    description: 'Controla el estado de tu licencia, plan actual y días de suscripción restantes en la nube.',
    placement: 'bottom',
    route: '/dashboard'
  },
  {
    targetId: 'tour-dashboard-hardware',
    title: 'Dispositivos Compatibles',
    description: 'KIOSNET ya está programado para conectarse con lectores de código de barra, ticketeras térmicas y pantallas secundarias sin configurar nada.',
    placement: 'top',
    route: '/dashboard'
  },

  // POS Steps
  {
    targetId: 'tour-pos-scanner',
    title: 'Buscador y Lector de Barra',
    description: 'Escribe el nombre de un artículo o escanea su código de barras aquí para añadirlo al instante.',
    placement: 'bottom',
    route: '/pos'
  },
  {
    targetId: 'tour-pos-categories',
    title: 'Categorías Rápidas',
    description: 'Filtra tus productos por categorías para encontrarlos más rápido visualmente.',
    placement: 'bottom',
    route: '/pos'
  },
  {
    targetId: 'tour-pos-cart',
    title: 'Carrito de Compras',
    description: 'Aquí verás el detalle de los productos cargados, cantidades, descuentos y el total a cobrar.',
    placement: 'left',
    route: '/pos'
  },
  {
    targetId: 'tour-pos-cobrar',
    title: 'Finalizar y Cobrar',
    description: 'Haz clic aquí para seleccionar el medio de pago (Efectivo, Débito, Transferencia, Cuenta Corriente) y registrar la venta.',
    placement: 'top',
    route: '/pos'
  },

  // Inventory Steps
  {
    targetId: 'tour-inv-add',
    title: 'Agregar Nuevo Producto',
    description: 'Haz clic aquí para dar de alta un producto en tu catálogo, configurar su precio de costo, venta y stock mínimo de alerta.',
    placement: 'bottom',
    route: '/inventory'
  },

  // Cash Steps
  {
    targetId: 'tour-cash-actions',
    title: 'Operaciones de Caja',
    description: 'Abre la caja inicializando el saldo, registra ingresos o retiros manuales de efectivo, y realiza arqueos detallados al final del día.',
    placement: 'bottom',
    route: '/cash'
  }
];

export const useTourStore = create<TourState>((set, get) => ({
  active: false,
  stepIndex: 0,
  steps: [],

  startTour: () => {
    // If starting manually or first time
    set({ active: true, stepIndex: 0 });
  },

  setStepsForRoute: (pathname: string) => {
    // Filter steps that match the current route
    const filteredSteps = ALL_STEPS.filter(step => step.route === pathname);
    set({ steps: filteredSteps, stepIndex: 0 });
  },

  nextStep: () => {
    const { stepIndex, steps } = get();
    if (stepIndex < steps.length - 1) {
      set({ stepIndex: stepIndex + 1 });
    } else {
      get().endTour();
    }
  },

  prevStep: () => {
    const { stepIndex } = get();
    if (stepIndex > 0) {
      set({ stepIndex: stepIndex - 1 });
    }
  },

  endTour: async () => {
    const user = useAuthStore.getState().user;
    if (user) {
      localStorage.setItem(`kiosnet_onboarding_completed_${user.id}`, 'true');
      try {
        await supabase
          .from('User')
          .update({ onboardingCompleted: true })
          .eq('id', user.id);
        
        useAuthStore.setState({
          user: {
            ...user,
            onboardingCompleted: true
          }
        });
      } catch (err) {
        console.error('Error updating onboarding status in Supabase:', err);
      }
    } else {
      localStorage.setItem('kiosnet_onboarding_completed', 'true');
    }
    set({ active: false, stepIndex: 0, steps: [] });
  }
}));
