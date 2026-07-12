import { create } from 'zustand';
import { supabase } from '../utils/supabaseClient';
import { useAuthStore } from './useAuthStore';
import { useCashStore } from './useCashStore';

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
  activeRoute: string | null;
  startTourForRoute: (route: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTour: () => void;
}

const ROUTE_STEPS: Record<string, TourStep[]> = {
  '/dashboard': [
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
    }
  ],
  '/billing': [
    {
      targetId: 'tour-sub-plans',
      title: 'Selección de Planes',
      description: 'Elige entre el Plan Estándar (ventas normales) o el Plan Pro (sincronización multiusuario y ventas ilimitadas).',
      placement: 'bottom',
      route: '/billing'
    },
    {
      targetId: 'tour-sub-months',
      title: 'Duración y Bonificaciones',
      description: 'Elige por cuántos meses quieres contratar. Contratar 12 meses te otorga 2 meses de regalo (pagas 10).',
      placement: 'top',
      route: '/billing'
    },
    {
      targetId: 'tour-sub-total',
      title: 'Total a Pagar',
      description: 'Visualiza el monto total final en Pesos Argentinos consolidando promociones vigentes.',
      placement: 'top',
      route: '/billing'
    },
    {
      targetId: 'tour-sub-pay',
      title: 'Medios de Pago',
      description: 'Paga de forma segura e inmediata usando tu tarjeta de crédito o escaneando el código QR con Mercado Pago.',
      placement: 'top',
      route: '/billing'
    },
    {
      targetId: 'tour-sub-notify',
      title: 'Notificar Transferencias',
      description: 'Si realizas una transferencia bancaria o necesitas asistencia manual, puedes notificar directamente al administrador desde aquí.',
      placement: 'top',
      route: '/billing'
    }
  ],
  '/pos': [
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
    }
  ],
  '/inventory': [
    {
      targetId: 'tour-inv-search',
      title: 'Buscador y Filtros',
      description: 'Busca productos por su nombre o código de barras, y aplica filtros rápidos para controlar tu stock.',
      placement: 'bottom',
      route: '/inventory'
    },
    {
      targetId: 'tour-inv-add',
      title: 'Agregar Nuevo Producto',
      description: 'Haz clic aquí para dar de alta un producto en tu catálogo, configurar su precio de costo, venta y stock mínimo de alerta.',
      placement: 'bottom',
      route: '/inventory'
    },
    {
      targetId: 'tour-inv-table',
      title: 'Lista de Productos',
      description: 'Administra tus precios, stocks, unidades y categorías. También puedes editar o eliminar artículos.',
      placement: 'top',
      route: '/inventory'
    }
  ],
  '/cash_closed': [
    {
      targetId: 'tour-cash-open-input',
      title: 'Monto de Apertura',
      description: 'Ingresa el saldo en efectivo disponible en tu caja registradora física para inicializar el turno diario.',
      placement: 'bottom',
      route: '/cash'
    },
    {
      targetId: 'tour-cash-open-btn',
      title: 'Confirmar Apertura',
      description: 'Presiona este botón para abrir la caja y habilitar la facturación en el POS y la carga de transacciones.',
      placement: 'bottom',
      route: '/cash'
    }
  ],
  '/cash_open': [
    {
      targetId: 'tour-cash-stats',
      title: 'Indicadores Financieros',
      description: 'Monitorea el efectivo actual acumulado en caja física, gastos cargados, ganancias estimadas y total de ventas del día.',
      placement: 'bottom',
      route: '/cash'
    },
    {
      targetId: 'tour-cash-payments',
      title: 'Recaudación por Canales',
      description: 'Revisa el desglose de ingresos según el medio de pago utilizado por los clientes (Efectivo, Débito, Crédito, Cta. Cte., Transferencia).',
      placement: 'bottom',
      route: '/cash'
    },
    {
      targetId: 'tour-cash-actions',
      title: 'Operaciones e Historial',
      description: 'Carga retiros manuales o ingresos de efectivo a caja, consulta arqueos anteriores o cierra la caja del turno.',
      placement: 'bottom',
      route: '/cash'
    }
  ],
  '/history': [
    {
      targetId: 'tour-hist-summary',
      title: 'Resumen de Período',
      description: 'Visualiza de forma rápida la facturación de ventas, egresos y el balance neto consolidado en el período activo.',
      placement: 'bottom',
      route: '/history'
    },
    {
      targetId: 'tour-hist-period',
      title: 'Rango de Fecha',
      description: 'Filtra las transacciones registradas por hoy, esta semana, quincena o los últimos 30 días para un análisis puntual.',
      placement: 'bottom',
      route: '/history'
    },
    {
      targetId: 'tour-hist-search',
      title: 'Buscar Operaciones',
      description: 'Encuentra transacciones rápidamente buscando por descripción de producto, ID único o notas asociadas.',
      placement: 'bottom',
      route: '/history'
    },
    {
      targetId: 'tour-hist-table',
      title: 'Lista de Transacciones',
      description: 'Muestra todas las operaciones detalladas. Haz clic sobre cualquier fila para expandir y ver qué productos se vendieron.',
      placement: 'top',
      route: '/history'
    }
  ],
  '/reports': [
    {
      targetId: 'tour-reports-stats',
      title: 'Indicadores de Negocio',
      description: 'Analiza de un vistazo las ventas totales, gastos, ganancias reales y cantidad de operaciones.',
      placement: 'bottom',
      route: '/reports'
    },
    {
      targetId: 'tour-reports-chart',
      title: 'Gráfico de Rendimiento',
      description: 'Compara visualmente tus flujos de ingresos frente a las ganancias netas del negocio a lo largo del tiempo.',
      placement: 'top',
      route: '/reports'
    },
    {
      targetId: 'tour-reports-categories',
      title: 'Ventas por Categoría',
      description: 'Observa la distribución en gráfico de torta de los rubros que más ingresos te generan.',
      placement: 'left',
      route: '/reports'
    }
  ],
  '/settings': [
    {
      targetId: 'tour-settings-nav',
      title: 'Navegación de Ajustes',
      description: 'Navega por las categorías: datos del comercio, alertas de stock, display de cliente y opciones de seguridad.',
      placement: 'right',
      route: '/settings'
    },
    {
      targetId: 'tour-settings-content',
      title: 'Configuraciones de la Sección',
      description: 'Modifica los valores del negocio, cambia el PIN de seguridad de administrador o activa alertas automáticas.',
      placement: 'left',
      route: '/settings'
    }
  ],
  '/display': [
    {
      targetId: 'tour-display-main',
      title: 'Pantalla de Cliente',
      description: 'Esta pantalla muestra en tiempo real al cliente lo que está comprando. Proporciona total transparencia en mostrador.',
      placement: 'center',
      route: '/display'
    }
  ]
};

export const useTourStore = create<TourState>((set, get) => ({
  active: false,
  stepIndex: 0,
  steps: [],
  activeRoute: null,

  startTourForRoute: (route: string) => {
    let stepsToUse = ROUTE_STEPS[route] || [];
    if (route === '/cash') {
      const isRegisterOpen = useCashStore.getState().session.isOpen;
      stepsToUse = isRegisterOpen ? ROUTE_STEPS['/cash_open'] : ROUTE_STEPS['/cash_closed'];
    }
    set({ active: true, stepIndex: 0, steps: stepsToUse, activeRoute: route });
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
    const { activeRoute } = get();
    if (user && activeRoute) {
      let storageKey = `kiosnet_tour_completed_${activeRoute}_${user.id}`;
      if (activeRoute === '/cash') {
        const isRegisterOpen = useCashStore.getState().session.isOpen;
        storageKey = `kiosnet_tour_completed_/cash_${isRegisterOpen ? 'open' : 'closed'}_${user.id}`;
      }
      localStorage.setItem(storageKey, 'true');
      
      // Mark overall onboarding as true in database when they complete dashboard
      if (activeRoute === '/dashboard' || activeRoute === '/billing') {
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
      }
    } else {
      localStorage.setItem('kiosnet_onboarding_completed', 'true');
    }
    set({ active: false, stepIndex: 0, steps: [], activeRoute: null });
  }
}));
