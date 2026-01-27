import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const body = await req.json()
    const { action, data, type } = body
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')

    console.log(`[mercadopago-webhook] Evento recebido: ${type} - ${action}`, { data })

    if (type === 'payment') {
      // 1. Validar pagamento direto na API do MP (Segurança)
      const paymentResp = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
      })
      const payment = await paymentResp.json()

      if (payment.status === 'approved') {
        const userId = payment.external_reference
        
        // Atualizar assinatura
        const nextMonth = new Date()
        nextMonth.setMonth(nextMonth.getMonth() + 1)

        await supabaseAdmin.from('subscriptions').update({
          status: 'active',
          paid_until: nextMonth.toISOString(),
          updated_at: new Date().toISOString()
        }).eq('user_id', userId)

        // Log de pagamento
        await supabaseAdmin.from('payments_log').insert({
          user_id: userId,
          payment_id_mp: payment.id.toString(),
          amount: payment.transaction_amount,
          status: 'approved',
          payload: payment
        })
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error("[mercadopago-webhook] Erro crítico:", error.message)
    return new Response('Error', { status: 400 })
  }
})