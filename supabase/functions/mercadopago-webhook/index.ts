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
    const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')

    console.log(`[mercadopago-webhook] Evento recebido: ${type} - ${action}`, { data })

    if (type === 'payment') {
      // 1. Validar pagamento direto na API do MP (Segurança)
      const paymentResp = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { 'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}` }
      })
      const payment = await paymentResp.json()

      if (payment.status === 'approved') {
        // external_reference é o user.id
        const userId = payment.external_reference
        
        // Definir validade (30 dias)
        const paidUntil = new Date()
        paidUntil.setDate(paidUntil.getDate() + 30)

        // Atualizar ou criar a assinatura com status ativo e data de expiração
        await supabaseAdmin.from('subscriptions').upsert({
          user_id: userId,
          status: 'active',
          paid_until: paidUntil.toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })

        // Log de pagamento
        await supabaseAdmin.from('payments_log').insert({
          user_id: userId,
          payment_id_mp: payment.id.toString(),
          amount: payment.transaction_amount,
          status: 'approved',
          payload: payment
        })
        
        console.log(`[mercadopago-webhook] Assinatura de ${userId} ativada até ${paidUntil.toISOString()}`);
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error("[mercadopago-webhook] Erro crítico:", error.message)
    return new Response('Error', { status: 400 })
  }
})