import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const functionName = "mercadopago-subscription";

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Não autorizado');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('Sessão expirada');

    const body = await req.json().catch(() => ({}));
    const { name, tax_id, redirect_url } = body;

    // Se não vier redirect_url, usa a URL do projeto por segurança
    const finalBackUrl = redirect_url || "https://klokjxcaeamgbfowmbqf.supabase.co";

    const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) throw new Error('Configuração de API ausente.');

    // 1. Cliente MP
    const cleanTaxId = tax_id.replace(/\D/g, '');
    const idType = cleanTaxId.length > 11 ? 'CNPJ' : 'CPF';

    const customerResp = await fetch('https://api.mercadopago.com/v1/customers', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: user.email,
        first_name: name,
        identification: { type: idType, number: cleanTaxId }
      })
    });

    let customerData = await customerResp.json();
    let customerId = customerData.id;

    if (customerResp.status === 400 && customerData.cause?.[0]?.code === "already_exists_customer") {
      const searchResp = await fetch(`https://api.mercadopago.com/v1/customers/search?email=${user.email}`, {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
      });
      const searchResult = await searchResp.json();
      customerId = searchResult.results?.[0]?.id;
    } else if (customerResp.status >= 400) {
      throw new Error(`MP Cliente: ${customerData.message}`);
    }

    // 2. Assinatura
    const subResp = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: "Assinatura Mensal Concilia Pro",
        external_reference: user.id,
        payer_email: user.email,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: 49.90,
          currency_id: "BRL"
        },
        back_url: finalBackUrl,
        status: "pending"
      })
    });

    const subscription = await subResp.json();
    if (subResp.status >= 400) throw new Error(`MP Checkout: ${subscription.message}`);

    // 3. Registro
    await supabaseClient.from('subscriptions').upsert({
      user_id: user.id,
      customer_id_mp: customerId,
      subscription_id_mp: subscription.id,
      status: 'pending',
      updated_at: new Date().toISOString()
    });

    console.log(`[${functionName}] Sucesso! Retornando link para ${finalBackUrl}`);
    
    return new Response(JSON.stringify({ init_point: subscription.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error(`[mercadopago-subscription] Erro:`, err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: corsHeaders
    });
  }
})