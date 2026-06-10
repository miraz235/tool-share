import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
  type UseMutationResult,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Category,
  Tool,
  Booking,
  BookingInput,
  Review,
  InsuranceTiers,
  PublicUser,
  Message,
  AdminStats,
  AdminBookingRow,
  AdminReviewRow,
  AdminEmailLog,
  AIRecommendation,
} from '@/types';

export type ToolSearchParams = {
  q?: string;
  city?: string;
  category?: string;
  listing_type?: string;
  max_price?: number;
  viewer_currency?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
  owner_id?: string;
};

export type AIQuota = {
  remaining: number;
  total: number;
  unlimited: boolean;
};

export const queryKeys = {
  categories: ['categories'] as const,
  tools: (params: ToolSearchParams = {}) => ['tools', params] as const,
  tool: (id: string) => ['tool', id] as const,
  toolReviews: (toolId: string) => ['reviews', 'tool', toolId] as const,
  toolUnavailableDates: (id: string) => ['tools', id, 'unavailable_dates'] as const,
  insuranceTiers: ['insurance', 'tiers'] as const,
  favorites: ['favorites'] as const,
  follows: ['follows'] as const,
  followCheck: (userId: string) => ['follows', 'check', userId] as const,
  myTools: ['myTools'] as const,
  bookings: (role: 'owner' | 'renter' | 'all' = 'all') => ['bookings', role] as const,
  booking: (id: string) => ['booking', id] as const,
  threads: ['messages', 'threads'] as const,
  messages: (bookingId: string) => ['messages', bookingId] as const,
  publicUser: (id: string) => ['user', id] as const,
  userTools: (id: string) => ['userTools', id] as const,
  userReviews: (id: string) => ['userReviews', id] as const,
  adminStats: ['admin', 'stats'] as const,
  adminUsers: (q = '') => ['admin', 'users', q] as const,
  adminBookings: ['admin', 'bookings'] as const,
  adminTools: ['admin', 'tools'] as const,
  adminReviews: ['admin', 'reviews'] as const,
  adminEmails: ['admin', 'emails'] as const,
  aiQuota: ['ai', 'quota'] as const,
  aiRecommend: (task: string) => ['ai', 'recommend', task] as const,
  unreadCount: ['messages', 'unreadCount'] as const,
  paymentStatus: (sessionId: string) => ['payment', 'status', sessionId] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useCategories(options?: Omit<UseQueryOptions<Category[], unknown>, 'queryKey' | 'queryFn'>) {
  return useQuery<Category[], unknown>({
    queryKey: queryKeys.categories,
    queryFn: async () => {
      const res = await api.get<Category[]>('/categories');
      return res.data;
    },
    ...options,
  });
}

export function useTools(
  params: ToolSearchParams = {},
  options?: Omit<UseQueryOptions<Tool[], unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<Tool[], unknown>({
    queryKey: queryKeys.tools(params),
    queryFn: async () => {
      const res = await api.get<Tool[]>('/tools', { params });
      return res.data;
    },
    placeholderData: keepPreviousData,
    ...options,
  });
}

export function useTool(id?: string, options?: Omit<UseQueryOptions<Tool, unknown>, 'queryKey' | 'queryFn'>) {
  return useQuery<Tool, unknown>({
    queryKey: queryKeys.tool(id ?? ''),
    queryFn: async () => {
      const res = await api.get<Tool>(`/tools/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
    ...options,
  });
}

export function useToolReviews(toolId?: string, options?: Omit<UseQueryOptions<Review[], unknown>, 'queryKey' | 'queryFn'>) {
  return useQuery<Review[], unknown>({
    queryKey: queryKeys.toolReviews(toolId ?? ''),
    queryFn: async () => {
      const res = await api.get<Review[]>('/reviews', { params: { tool_id: toolId } });
      return res.data;
    },
    enabled: Boolean(toolId),
    ...options,
  });
}

export function useToolUnavailableDates(
  id?: string,
  options?: Omit<UseQueryOptions<{ dates: string[] }, unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<{ dates: string[] }, unknown>({
    queryKey: queryKeys.toolUnavailableDates(id ?? ''),
    queryFn: async () => {
      const res = await api.get<{ dates: string[] }>(`/tools/${id}/unavailable_dates`);
      return res.data;
    },
    enabled: Boolean(id),
    ...options,
  });
}

export function useInsuranceTiers(options?: Omit<UseQueryOptions<InsuranceTiers, unknown>, 'queryKey' | 'queryFn'>) {
  return useQuery<InsuranceTiers, unknown>({
    queryKey: queryKeys.insuranceTiers,
    queryFn: async () => {
      const res = await api.get<InsuranceTiers>('/insurance/tiers');
      return res.data;
    },
    ...options,
  });
}

export function useFavorites(
  enabled = true,
  options?: Omit<UseQueryOptions<Tool[], unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<Tool[], unknown>({
    queryKey: queryKeys.favorites,
    queryFn: async () => {
      const res = await api.get<Tool[]>('/favorites');
      return res.data;
    },
    enabled,
    ...options,
  });
}

export function useFollows(
  enabled = true,
  options?: Omit<UseQueryOptions<PublicUser[], unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<PublicUser[], unknown>({
    queryKey: queryKeys.follows,
    queryFn: async () => {
      const res = await api.get<PublicUser[]>('/follows');
      return res.data;
    },
    enabled,
    ...options,
  });
}

export function useFollowCheck(
  userId?: string,
  options?: Omit<UseQueryOptions<{ following: boolean }, unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<{ following: boolean }, unknown>({
    queryKey: queryKeys.followCheck(userId ?? ''),
    queryFn: async () => {
      const res = await api.get<{ following: boolean }>(`/follows/check/${userId}`);
      return res.data;
    },
    enabled: Boolean(userId),
    ...options,
  });
}

export function useMyTools(
  enabled = true,
  options?: Omit<UseQueryOptions<Tool[], unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<Tool[], unknown>({
    queryKey: queryKeys.myTools,
    queryFn: async () => {
      const res = await api.get<Tool[]>('/my/tools');
      return res.data;
    },
    enabled,
    ...options,
  });
}

export function useBookings(
  role: 'owner' | 'renter' | 'all' = 'all',
  enabled = true,
  options?: Omit<UseQueryOptions<Booking[], unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<Booking[], unknown>({
    queryKey: queryKeys.bookings(role),
    queryFn: async () => {
      const params = role === 'all' ? {} : { role };
      const res = await api.get<Booking[]>('/bookings', { params });
      return res.data;
    },
    enabled,
    ...options,
  });
}

export function useBooking(id?: string, options?: Omit<UseQueryOptions<Booking, unknown>, 'queryKey' | 'queryFn'>) {
  return useQuery<Booking, unknown>({
    queryKey: queryKeys.booking(id ?? ''),
    queryFn: async () => {
      const res = await api.get<Booking>(`/bookings/${id}`);
      return res.data;
    },
    enabled: Boolean(id),
    ...options,
  });
}

export function useMessageThreads(
  enabled = true,
  options?: Omit<UseQueryOptions<Message[], unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<Message[], unknown>({
    queryKey: queryKeys.threads,
    queryFn: async () => {
      const res = await api.get<Message[]>('/messages/threads');
      return res.data;
    },
    enabled,
    ...options,
  });
}

export function useMessages(
  bookingId?: string,
  options?: Omit<UseQueryOptions<Message[], unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<Message[], unknown>({
    queryKey: queryKeys.messages(bookingId ?? ''),
    queryFn: async () => {
      const res = await api.get<Message[]>(`/messages/${bookingId}`);
      return res.data;
    },
    enabled: Boolean(bookingId),
    ...options,
  });
}

export function usePublicUser(
  userId?: string,
  options?: Omit<UseQueryOptions<PublicUser, unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<PublicUser, unknown>({
    queryKey: queryKeys.publicUser(userId ?? ''),
    queryFn: async () => {
      const res = await api.get<PublicUser>(`/users/${userId}`);
      return res.data;
    },
    enabled: Boolean(userId),
    ...options,
  });
}

export function useUserTools(
  userId?: string,
  options?: Omit<UseQueryOptions<Tool[], unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<Tool[], unknown>({
    queryKey: queryKeys.userTools(userId ?? ''),
    queryFn: async () => {
      const res = await api.get<Tool[]>('/tools', { params: { owner_id: userId } });
      return res.data;
    },
    enabled: Boolean(userId),
    ...options,
  });
}

export function useUserReviews(
  userId?: string,
  options?: Omit<UseQueryOptions<Review[], unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<Review[], unknown>({
    queryKey: queryKeys.userReviews(userId ?? ''),
    queryFn: async () => {
      const res = await api.get<Review[]>('/reviews', { params: { user_id: userId } });
      return res.data;
    },
    enabled: Boolean(userId),
    ...options,
  });
}

export function useUnreadCount(
  enabled = true,
  options?: Omit<UseQueryOptions<{ count: number }, unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<{ count: number }, unknown>({
    queryKey: queryKeys.unreadCount,
    queryFn: async () => {
      const res = await api.get<{ count: number }>('/messages/unread/count');
      return res.data;
    },
    enabled,
    refetchInterval: 15000,
    ...options,
  });
}

export function useAIQuota(
  enabled = true,
  options?: Omit<UseQueryOptions<AIQuota, unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<AIQuota, unknown>({
    queryKey: queryKeys.aiQuota,
    queryFn: async () => {
      const res = await api.get<AIQuota>('/ai/quota');
      return res.data;
    },
    enabled,
    ...options,
  });
}

export function useAdminStats(options?: Omit<UseQueryOptions<AdminStats, unknown>, 'queryKey' | 'queryFn'>) {
  return useQuery<AdminStats, unknown>({
    queryKey: queryKeys.adminStats,
    queryFn: async () => {
      const res = await api.get<AdminStats>('/admin/stats');
      return res.data;
    },
    ...options,
  });
}

export function useAdminUsers(
  search?: string,
  options?: Omit<UseQueryOptions<PublicUser[], unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<PublicUser[], unknown>({
    queryKey: queryKeys.adminUsers(search ?? ''),
    queryFn: async () => {
      const res = await api.get<PublicUser[]>('/admin/users', {
        params: search ? { q: search } : {},
      });
      return res.data;
    },
    ...options,
  });
}

export function useAdminBookings(options?: Omit<UseQueryOptions<AdminBookingRow[], unknown>, 'queryKey' | 'queryFn'>) {
  return useQuery<AdminBookingRow[], unknown>({
    queryKey: queryKeys.adminBookings,
    queryFn: async () => {
      const res = await api.get<AdminBookingRow[]>('/admin/bookings');
      return res.data;
    },
    ...options,
  });
}

export function useAdminTools(options?: Omit<UseQueryOptions<Tool[], unknown>, 'queryKey' | 'queryFn'>) {
  return useQuery<Tool[], unknown>({
    queryKey: queryKeys.adminTools,
    queryFn: async () => {
      const res = await api.get<Tool[]>('/admin/tools');
      return res.data;
    },
    ...options,
  });
}

export function useAdminReviews(options?: Omit<UseQueryOptions<AdminReviewRow[], unknown>, 'queryKey' | 'queryFn'>) {
  return useQuery<AdminReviewRow[], unknown>({
    queryKey: queryKeys.adminReviews,
    queryFn: async () => {
      const res = await api.get<AdminReviewRow[]>('/admin/reviews');
      return res.data;
    },
    ...options,
  });
}

export function useAdminEmails(options?: Omit<UseQueryOptions<AdminEmailLog[], unknown>, 'queryKey' | 'queryFn'>) {
  return useQuery<AdminEmailLog[], unknown>({
    queryKey: queryKeys.adminEmails,
    queryFn: async () => {
      const res = await api.get<AdminEmailLog[]>('/admin/email_log');
      return res.data;
    },
    ...options,
  });
}

/** NEW: Polls Stripe payment status by session ID. Used in BookingDetail after Stripe redirect. */
export function usePaymentStatus(
  sessionId?: string,
  options?: Omit<UseQueryOptions<{ payment_status: string; status: string }, unknown>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<{ payment_status: string; status: string }, unknown>({
    queryKey: queryKeys.paymentStatus(sessionId ?? ''),
    queryFn: async () => {
      const res = await api.get<{ payment_status: string; status: string }>(`/payments/status/${sessionId}`);
      return res.data;
    },
    enabled: Boolean(sessionId),
    ...options,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateBooking(): UseMutationResult<Booking, unknown, BookingInput, unknown> {
  const queryClient = useQueryClient();
  return useMutation<Booking, unknown, BookingInput>({
    mutationFn: async (input: BookingInput) => {
      const res = await api.post<Booking>('/bookings', input);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings('renter') });
    },
  });
}

export function usePurchaseTool(): UseMutationResult<any, unknown, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation<any, unknown, string>({
    mutationFn: async (toolId: string) => {
      const res = await api.post('/purchases', null, { params: { tool_id: toolId } });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
      queryClient.invalidateQueries({ queryKey: queryKeys.myTools });
    },
  });
}

export function useToggleFavorite(): UseMutationResult<any, unknown, { toolId: string; remove: boolean }, unknown> {
  const queryClient = useQueryClient();
  return useMutation<any, unknown, { toolId: string; remove: boolean }>({
    mutationFn: async ({ toolId, remove }) => {
      if (remove) return api.delete(`/favorites/${toolId}`).then((r) => r.data);
      return api.post(`/favorites/${toolId}`).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
      queryClient.invalidateQueries({ queryKey: queryKeys.tools() });
    },
  });
}

export function useToggleFollow(): UseMutationResult<any, unknown, { userId: string; remove: boolean }, unknown> {
  const queryClient = useQueryClient();
  return useMutation<any, unknown, { userId: string; remove: boolean }>({
    mutationFn: async ({ userId, remove }) => {
      if (remove) return api.delete(`/follows/${userId}`).then((r) => r.data);
      return api.post(`/follows/${userId}`).then((r) => r.data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.follows });
      queryClient.invalidateQueries({ queryKey: queryKeys.followCheck(variables.userId) });
    },
  });
}

export type ReviewPayload = {
  booking_id: string;
  rating: number;
  comment: string;
  target_type: string;
  condition_tag?: string;
};

export function useReviewMutation(): UseMutationResult<Review, unknown, ReviewPayload, unknown> {
  const queryClient = useQueryClient();
  return useMutation<Review, unknown, ReviewPayload>({
    mutationFn: async (payload) => {
      return api.post<Review>('/reviews', payload).then((r) => r.data);
    },
    onSuccess: (data, payload) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.booking(payload.booking_id) });
      if (payload.target_type === 'tool') {
        queryClient.invalidateQueries({ queryKey: queryKeys.toolReviews(data.tool_id) });
      }
    },
  });
}

export function useUpdateBookingStatus(): UseMutationResult<any, unknown, { id: string; status: string }, unknown> {
  const queryClient = useQueryClient();
  return useMutation<any, unknown, { id: string; status: string }>({
    mutationFn: async ({ id, status }) => {
      return api.put(`/bookings/${id}/status`, { status }).then((r) => r.data);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.booking(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings('owner') });
      queryClient.invalidateQueries({ queryKey: queryKeys.bookings('renter') });
    },
  });
}

export function useSendMessage(): UseMutationResult<any, unknown, { booking_id: string; content: string }, unknown> {
  const queryClient = useQueryClient();
  return useMutation<any, unknown, { booking_id: string; content: string }>({
    mutationFn: async (payload) => {
      return api.post('/messages', payload).then((r) => r.data);
    },
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(payload.booking_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.threads });
    },
  });
}

export function useBookingCheckout(): UseMutationResult<{ url: string }, unknown, string, unknown> {
  return useMutation<{ url: string }, unknown, string>({
    mutationFn: async (bookingId: string) => {
      const res = await api.post<{ url: string }>('/bookings/checkout', {
        booking_id: bookingId,
        origin_url: window.location.origin,
      });
      return res.data;
    },
  });
}

export function useAIRecommend(): UseMutationResult<AIRecommendation, unknown, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation<AIRecommendation, unknown, string>({
    mutationFn: async (task: string) => {
      const res = await api.post<AIRecommendation>('/ai/recommend', { task });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiQuota });
    },
  });
}

export function useDeleteTool(): UseMutationResult<any, unknown, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation<any, unknown, string>({
    mutationFn: async (toolId: string) => {
      await api.delete(`/tools/${toolId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myTools });
      queryClient.invalidateQueries({ queryKey: queryKeys.tools() });
    },
  });
}

export function useVerifyIdentity(): UseMutationResult<{ url: string }, unknown, void, unknown> {
  return useMutation<{ url: string }, unknown, void>({
    mutationFn: async () => {
      const res = await api.post<{ url: string }>('/identity/verify/start', {
        return_url: window.location.origin + '/dashboard',
      });
      return res.data;
    },
  });
}

export function useUpdateFavoriteAlerts(): UseMutationResult<any, unknown, { toolId: string; alerts: boolean }, unknown> {
  const queryClient = useQueryClient();
  return useMutation<any, unknown, { toolId: string; alerts: boolean }>({
    mutationFn: async ({ toolId, alerts }) => {
      await api.post(`/favorites/${toolId}`, null, { params: { alerts } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  });
}

export function useAdminUpdateUser(): UseMutationResult<any, unknown, { userId: string; field: string; value: any }, unknown> {
  const queryClient = useQueryClient();
  return useMutation<any, unknown, { userId: string; field: string; value: any }>({
    mutationFn: async ({ userId, field, value }) => {
      await api.put(`/admin/users/${userId}`, { [field]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers() });
    },
  });
}

export function useAdminDisputeBooking(): UseMutationResult<any, unknown, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation<any, unknown, string>({
    mutationFn: async (bookingId: string) => {
      return api.put(`/admin/bookings/${bookingId}/dispute`).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminBookings });
    },
  });
}

export function useAdminHideReview(): UseMutationResult<any, unknown, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation<any, unknown, string>({
    mutationFn: async (reviewId: string) => {
      return api.put(`/admin/reviews/${reviewId}/hide`).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminReviews });
    },
  });
}

export function useAdminFeatureTool(): UseMutationResult<any, unknown, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation<any, unknown, string>({
    mutationFn: async (toolId: string) => {
      return api.put(`/admin/tools/${toolId}/feature`).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTools });
    },
  });
}

export function useUploadImage(): UseMutationResult<{ path: string }, unknown, File, unknown> {
  return useMutation<{ path: string }, unknown, File>({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{ path: string }>('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
  });
}

export function useCreateTool(): UseMutationResult<Tool, unknown, any, unknown> {
  const queryClient = useQueryClient();
  return useMutation<Tool, unknown, any>({
    mutationFn: async (payload: any) => {
      const res = await api.post<Tool>('/tools', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myTools });
      queryClient.invalidateQueries({ queryKey: queryKeys.tools() });
    },
  });
}