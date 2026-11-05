const $=selector=>document.querySelector(selector);
const text=(node,name)=>node.querySelector(name)?.textContent?.trim()||"";
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
const money=value=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(value));
const fallbackImage="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 240'%3E%3Crect width='320' height='240' fill='%23eef2f5'/%3E%3Ctext x='160' y='125' fill='%2364748b' font-size='18' text-anchor='middle'%3EImage unavailable%3C/text%3E%3C/svg%3E";
const state={products:[],reviews:[],employees:[],customers:[],invoices:[],cart:JSON.parse(localStorage.getItem("cart")||"[]"),orders:JSON.parse(localStorage.getItem("orders")||"[]")};
const normalize=value=>String(value??"").trim().toLowerCase();
let previousScroll=window.scrollY;
function parseReviews(documentXml){return[...documentXml.querySelectorAll("review")].map(node=>({productId:Number(text(node,"product_id")),customerId:Number(text(node,"customer_id")),rating:Number(text(node,"rating")),comment:text(node,"comment"),date:text(node,"date")}));}
async function readData(){
	const responses=await Promise.all(["products.xml","reviews.xml","employees.json","customer.json","carts.xml"].map(file=>fetch(file)));
	if(responses.some(response=>!response.ok))throw new Error("Không thể đọc dữ liệu cục bộ.");
	const productsXml=new DOMParser().parseFromString(await responses[0].text(),"application/xml");
	const reviewsXml=new DOMParser().parseFromString(await responses[1].text(),"application/xml");
	const cartsXml=new DOMParser().parseFromString(await responses[4].text(),"application/xml");
	if(productsXml.querySelector("parsererror")||reviewsXml.querySelector("parsererror")||cartsXml.querySelector("parsererror"))throw new Error("Tệp XML không đúng định dạng.");
	state.products=[...productsXml.querySelectorAll("product")].map(node=>({id:Number(text(node,"id")),title:text(node,"title"),price:Number(text(node,"price")),description:text(node,"description"),category:text(node,"category"),image:text(node,"image"),rating:Number(text(node,"rating")),ratingCount:Number(text(node,"rating_count")),color:text(node,"color"),stock:Number(text(node,"stock"))}));
	state.reviews=parseReviews(reviewsXml);
	state.employees=await responses[2].json();
	state.customers=await responses[3].json();
	state.invoices=[...cartsXml.querySelectorAll("invoice")];
	fillFilters();
	renderProducts();
	renderCart();
}
function fillFilters(){
	$("#category").insertAdjacentHTML("beforeend",[...new Set(state.products.map(product=>product.category))].sort().map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(""));
	$("#color").insertAdjacentHTML("beforeend",[...new Set(state.products.map(product=>product.color))].sort().map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(""));
}
function getFilters(){return{keyword:normalize($("#keyword").value),category:$("#category").value,minPrice:Number($("#minPrice").value)||0,maxPrice:Number($("#maxPrice").value)||Infinity,color:$("#color").value,rating:Number($("#rating").value)||0};}
function averageRating(id){const reviews=state.reviews.filter(review=>review.productId===id);return reviews.length?reviews.reduce((sum,review)=>sum+review.rating,0)/reviews.length:0;}
function renderProducts(){
	const filters=getFilters();
	const items=state.products.filter(product=>(!filters.keyword||normalize(product.title).includes(filters.keyword))&&(!filters.category||product.category===filters.category)&&product.price>=filters.minPrice&&product.price<=filters.maxPrice&&(!filters.color||product.color===filters.color)&&product.rating>=filters.rating);
	$("#skeletonGrid").hidden=true;
	$("#emptyState").hidden=items.length>0;
	$("#resultSummary").textContent=`${items.length}/${state.products.length} sản phẩm`;
	$("#productGrid").innerHTML=items.map(product=>{const average=averageRating(product.id);return`<article class="product-card"><div class="product-image"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}" loading="lazy" data-fallback="${fallbackImage}"><span class="average-rating">★ ${average?average.toFixed(1):product.rating}</span></div><div class="product-info"><h3>${escapeHtml(product.title)}</h3><p>${escapeHtml(product.category)} · ${escapeHtml(product.color)} · Còn ${product.stock}</p><span class="rating">★ ${product.rating} (${product.ratingCount})</span><strong class="price">${money(product.price)}</strong><div class="card-actions"><button class="button button-secondary" data-action="quick" data-id="${product.id}" type="button">Xem nhanh</button><button class="button button-secondary" data-action="reviews" data-id="${product.id}" type="button">Rating Detail</button><button class="button button-primary" data-action="add" data-id="${product.id}" data-variant="${escapeHtml(product.color)}" type="button">Thêm giỏ</button></div></div></article>`;}).join("");
	$("#productGrid").querySelectorAll("img[data-fallback]").forEach(image=>image.addEventListener("error",event=>{const failed=event.currentTarget;failed.src=failed.dataset.fallback;failed.removeAttribute("data-fallback");}));
}
function updateHeader(){const customer=JSON.parse(sessionStorage.getItem("customerUser")||"null");$("#customerLoginButton").textContent=customer?.name||"Khách hàng";$("#customerLoginButton").dataset.loggedIn=customer?"true":"false";$("#cartCount").textContent=state.cart.reduce((sum,item)=>sum+item.quantity,0);}
function saveCart(){localStorage.setItem("cart",JSON.stringify(state.cart));renderCart();updateHeader();}
function addToCart(id,variant){const product=state.products.find(item=>item.id===id);if(!product)return;const item=state.cart.find(entry=>entry.id===id&&entry.variant===variant);if(item)item.quantity=Math.min(item.quantity+1,product.stock);else state.cart.push({id,variant,quantity:1});saveCart();$("#miniCart").setAttribute("aria-hidden","false");}
function changeQuantity(id,variant,amount){const item=state.cart.find(entry=>entry.id===id&&entry.variant===variant);if(!item)return;item.quantity+=amount;if(item.quantity<=0)state.cart=state.cart.filter(entry=>entry!==item);saveCart();}
function renderCart(){const total=state.cart.reduce((sum,item)=>sum+(state.products.find(product=>product.id===item.id)?.price||0)*item.quantity,0);$("#cartTotal").textContent=money(total);$("#cartItems").innerHTML=state.cart.length?state.cart.map(item=>{const product=state.products.find(entry=>entry.id===item.id);return product?`<div class="cart-row"><div><h3>${escapeHtml(product.title)}</h3><p>${escapeHtml(item.variant)} · ${money(product.price)}</p></div><div class="quantity-control"><button data-cart-action="decrease" data-id="${product.id}" data-variant="${escapeHtml(item.variant)}" type="button">−</button><span>${item.quantity}</span><button data-cart-action="increase" data-id="${product.id}" data-variant="${escapeHtml(item.variant)}" type="button">+</button><button data-cart-action="remove" data-id="${product.id}" data-variant="${escapeHtml(item.variant)}" type="button">×</button></div></div>`:"";}).join(""):'<p class="empty-state">Giỏ hàng đang trống.</p>';updateHeader();}
function openReviews(id){const reviews=state.reviews.filter(review=>review.productId===id);$("#reviewsContent").innerHTML=reviews.length?reviews.map(review=>{const customer=state.customers.find(item=>Number(item.id)===review.customerId);return`<div class="review-item"><strong>${"★".repeat(review.rating)}</strong><p>${escapeHtml(review.comment)}</p><small>${escapeHtml(customer?.name||`Khách hàng #${review.customerId}`)} · ${escapeHtml(review.date)}</small></div>`;}).join(""):"<p>Chưa có đánh giá.</p>";$("#reviewsModal").hidden=false;}
function openQuickView(id){const product=state.products.find(item=>item.id===id);if(!product)return;$("#quickViewContent").innerHTML=`<div class="quick-product"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)}"><div><h3 id="quickViewTitle">${escapeHtml(product.title)}</h3><p>${escapeHtml(product.description)}</p><strong class="price">${money(product.price)}</strong><button class="button button-primary" data-quick-add="${product.id}" data-variant="${escapeHtml(product.color)}" type="button">Thêm vào giỏ</button></div></div>`;$("#quickView").hidden=false;}
function validateCheckout(){const data=new FormData($("#checkoutForm"));const rules={name:[/^.{2,}$/,"Họ tên không hợp lệ."],phone:[/^(0|\+84)(3|5|7|8|9)\d{8}$/,"Số điện thoại không hợp lệ."],email:[/^[^\s@]+@[^\s@]+\.[^\s@]+$/,"Email không hợp lệ."],address:[/^.{8,}$/,"Địa chỉ cần ít nhất 8 ký tự."]};let valid=true;Object.entries(rules).forEach(([name,[pattern,message]])=>{const value=String(data.get(name)||"").trim();$(`[data-error="${name}"]`).textContent=pattern.test(value)?"":message;if(!pattern.test(value))valid=false;});return{valid,data};}
function findAccount(accounts,identity,password,role){return accounts.find(item=>(normalize(item.username)===normalize(identity)||normalize(item.email)===normalize(identity))&&String(item.password??"").trim()===String(password??"").trim()&&(!role||normalize(item.role)===normalize(role))&&normalize(item.status)==="active");}
window.addEventListener("scroll",()=>{const currentScroll=window.scrollY;const header=document.querySelector(".site-header");if(currentScroll>previousScroll&&currentScroll>20)header.classList.add("header-hidden");else if(currentScroll<previousScroll)header.classList.remove("header-hidden");previousScroll=currentScroll;},{passive:true});
$("#searchForm").addEventListener("submit",event=>{event.preventDefault();renderProducts();});
$("#resetFilters").addEventListener("click",()=>setTimeout(renderProducts));
$("#productGrid").addEventListener("click",event=>{const action=event.target.closest("[data-action]");if(!action)return;const id=Number(action.dataset.id);if(action.dataset.action==="add")addToCart(id,action.dataset.variant);if(action.dataset.action==="quick")openQuickView(id);if(action.dataset.action==="reviews")openReviews(id);});
$("#cartButton").addEventListener("click",()=>$("#miniCart").setAttribute("aria-hidden","false"));
$("#cartItems").addEventListener("click",event=>{const action=event.target.closest("[data-cart-action]");if(!action)return;const amount=action.dataset.cartAction==="increase"?1:action.dataset.cartAction==="decrease"?-1:-999;changeQuantity(Number(action.dataset.id),action.dataset.variant,amount);});
$("#closeCart").addEventListener("click",()=>$("#miniCart").setAttribute("aria-hidden","true"));
$("#quickView").addEventListener("click",event=>{if(event.target===event.currentTarget)event.currentTarget.hidden=true;if(event.target.dataset.quickAdd)addToCart(Number(event.target.dataset.quickAdd),event.target.dataset.variant);});
$("#closeQuickView").addEventListener("click",()=>$("#quickView").hidden=true);
$("#closeReviews").addEventListener("click",()=>$("#reviewsModal").hidden=true);
$("#reviewsModal").addEventListener("click",event=>{if(event.target===event.currentTarget)event.currentTarget.hidden=true;});
$("#checkoutButton").addEventListener("click",()=>{if(!state.cart.length){$("#checkoutMessage").textContent="Giỏ hàng đang trống.";return;}if(!sessionStorage.getItem("customerUser")){$("#customerLoginModal").hidden=false;return;}$("#checkoutModal").hidden=false;});
$("#closeCheckout").addEventListener("click",()=>$("#checkoutModal").hidden=true);
$("#checkoutForm").querySelectorAll("input,textarea").forEach(input=>input.addEventListener("blur",validateCheckout));
$("#checkoutForm").addEventListener("submit",event=>{event.preventDefault();const result=validateCheckout();if(!result.valid)return;const total=state.cart.reduce((sum,item)=>sum+(state.products.find(product=>product.id===item.id)?.price||0)*item.quantity,0);state.orders.push({code:`LOCAL-${Date.now()}`,date:new Date().toISOString().slice(0,10),customer:result.data.get("name"),phone:result.data.get("phone"),total,items:state.cart});localStorage.setItem("orders",JSON.stringify(state.orders));state.cart=[];saveCart();$("#checkoutForm").reset();$("#checkoutMessage").textContent="Thanh toán thành công.";});
$("#loginButton").addEventListener("click",()=>$("#loginModal").hidden=false);
$("#closeLogin").addEventListener("click",()=>$("#loginModal").hidden=true);
$("#loginForm").addEventListener("submit",event=>{event.preventDefault();const data=new FormData(event.currentTarget);const employee=findAccount(state.employees,data.get("username"),data.get("password"),"admin");if(!employee){$("#loginMessage").textContent="Tên đăng nhập/email hoặc mật khẩu không đúng.";return;}sessionStorage.setItem("adminUser",JSON.stringify({id:employee.id,username:employee.username,role:employee.role}));window.location.href="admin.html";});
$("#customerLoginButton").addEventListener("click",()=>{if($("#customerLoginButton").dataset.loggedIn==="true"){sessionStorage.removeItem("customerUser");updateHeader();return;}$("#customerLoginModal").hidden=false;});
$("#closeCustomerLogin").addEventListener("click",()=>$("#customerLoginModal").hidden=true);
$("#customerLoginForm").addEventListener("submit",event=>{event.preventDefault();const data=new FormData(event.currentTarget);const customer=findAccount(state.customers,data.get("username"),data.get("password"));if(!customer){$("#customerLoginMessage").textContent="Tên đăng nhập/email hoặc mật khẩu không đúng.";return;}sessionStorage.setItem("customerUser",JSON.stringify({id:customer.id,username:customer.username,name:customer.name}));updateHeader();$("#customerLoginModal").hidden=true;$("#checkoutModal").hidden=false;$("#checkoutName").value=customer.name;$("#checkoutPhone").value=customer.phone;$("#checkoutEmail").value=customer.email;$("#checkoutAddress").value=customer.address;});
updateHeader();
readData().catch(error=>{$("#skeletonGrid").hidden=true;});
