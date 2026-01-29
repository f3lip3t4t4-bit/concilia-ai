import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const functionName = "mercadopago-checkout";

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error(`[${functionName}] Erro: Autorização ausente`);
      throw new Error('Não autorizado');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error(`[${functionName}] Usuário inválido`);
      throw new Error('Sessão inválida');
    }

    const body = await req.json().catch(() => ({}));
    const { name, tax_id, redirect_url } = body;

    if (!name || !tax_id || !redirect_url) {
      console.error(`[${functionName}] Dados insuficientes:`, { name, tax_id, redirect_url });
      throw new Error('Nome, documento e URL de retorno são obrigatórios');
    }

    // Garantir que a redirect_url não termine com barra para evitar double slashes
    const baseUrl = redirect_url.endsWith('/') ? redirect_url.slice(0, -1) : redirect_url;

    console.log(`[${functionName}] Gerando preferência para: ${user.email}. Base URL: ${baseUrl}`);

    const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!MERCADO_PAGO_ACCESS_TOKEN) {
      console.error(`[${functionName}] Erro: MERCADO_PAGO_ACCESS_TOKEN não configurado`);
      throw new Error('Configuração de pagamento ausente no servidor');
    }

    const cleanTaxId = tax_id.replace(/\D/g, '');
    const idType = cleanTaxId.length > 11 ? 'CNPJ' : 'CPF';

    const preference = {
      items: [{
        id: "concilia-pro-mensal",
        title: "Concilia Pro – Acesso Mensal",
        quantity: 1,
        currency_id: "BRL",
        unit_price: 49.90,
        description: "Assinatura mensal para o sistema Concilia"
      }],
      payer: {
        name,
        email: user.email,
        identification: {
          type: idType,
          number: cleanTaxId
        }
      },
      back_urls: {
        success: `${baseUrl}/success`,
        failure: `${baseUrl}/checkout`,
        pending: `${baseUrl}/pending`
      },
      auto_return: "approved",
      external_reference: user.id 
    }

    console.log(`[${functionName}] Enviando payload ao Mercado Pago:`, JSON.stringify(preference));

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preference)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error(`[${functionName}] Erro da API MP:`, data);
      throw new Error(data.message || "O Mercado Pago não pôde processar a requisição.");
    }

    return new Response(JSON.stringify({
      init_point: data.init_point,
      preference_id: data.id
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error(`[${functionName}] Erro:`, err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})