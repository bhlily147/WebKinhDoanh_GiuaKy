const adminMoney=value=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(value));
const adminText=(node,name)=>node.querySelector(name)?.textContent?.trim()||"";
const adminEscape=value=>String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
const statusLabel={paid:"Đã thanh toán",processing:"Đang xử lý",pending:"Chờ xử lý"};
async function loadAdmin(){
	const currentUser=JSON.parse(sessionStorage.getItem("adminUser")||"null");
	if(!currentUser){window.location.href="index.html";return;}
	const [employeesResponse,customersResponse,cartsResponse]=await Promise.all([fetch("employees.json"),fetch("customer.json"),fetch("carts.xml")]);
	if(!employeesResponse.ok||!customersResponse.ok||!cartsResponse.ok)throw new Error("Không thể đọc dữ liệu quản trị.");
	const employees=await employeesResponse.json();
	const customers=await customersResponse.json();
	const cartsXml=new DOMParser().parseFromString(await cartsResponse.text(),"application/xml");
	const invoices=[...cartsXml.querySelectorAll("invoice")].map(node=>({code:adminText(node,"invoice_code"),date:adminText(node,"created_at"),customer:`Khách hàng #${adminText(node,"customer_id")}`,status:adminText(node,"status"),total:[...node.querySelectorAll("detail")].reduce((sum,detail)=>sum+Number(adminText(detail,"unit_price"))*Number(adminText(detail,"quantity")),0)}));
	const localOrders=JSON.parse(localStorage.getItem("orders")||"[]").map(order=>({code:order.code,date:order.date,customer:order.customer,status:"paid",total:order.total}));
	const orders=[...invoices,...localOrders];
	const revenue=orders.reduce((sum,order)=>sum+order.total,0);
	document.querySelector("#revenueStat").textContent=adminMoney(revenue);
	document.querySelector("#orderStat").textContent=orders.length;
	document.querySelector("#customerStat").textContent=customers.length;
	const products=await fetch("products.xml").then(response=>response.text());
	document.querySelector("#productStat").textContent=(products.match(/<product>/g)||[]).length;
	document.querySelector("#orderCountLabel").textContent=`${orders.length} đơn hàng`;
	document.querySelector("#adminOrders").innerHTML=orders.map(order=>`<tr><td><strong>${adminEscape(order.code)}</strong></td><td>${adminEscape(order.customer)}</td><td>${adminEscape(order.date)}</td><td><strong>${adminMoney(order.total)}</strong></td><td><span class="order-status ${adminEscape(order.status)}">${adminEscape(statusLabel[order.status]||order.status)}</span></td></tr>`).join("");
	document.querySelector("#customerList").innerHTML=customers.slice(-5).reverse().map((customer,index)=>`<div class="customer-item"><span class="customer-avatar avatar-${index%4}">${adminEscape(customer.name.charAt(0))}</span><div><strong>${adminEscape(customer.name)}</strong><small>${adminEscape(customer.email)}</small></div><span class="customer-active">●</span></div>`).join("");
	renderStatusChart(orders);
	renderRevenueChart(orders);
}
function renderStatusChart(orders){
	const statuses=["paid","processing","pending"];
	const counts=statuses.map(status=>orders.filter(order=>order.status===status).length);
	document.querySelector("#orderStatusChart").innerHTML=statuses.map((status,index)=>`<div class="status-row"><div><span class="status-dot ${status}"></span>${statusLabel[status]}</div><strong>${counts[index]}</strong></div>`).join("");
}
function renderRevenueChart(orders){
	const canvas=document.querySelector("#revenueChart");
	const context=canvas.getContext("2d");
	const width=canvas.clientWidth;
	const height=canvas.height;
	const ratio=window.devicePixelRatio||1;
	canvas.width=width*ratio;
	canvas.height=height*ratio;
	context.scale(ratio,ratio);
	context.clearRect(0,0,width,height);
	const values=orders.slice(-7).map(order=>order.total);
	const labels=orders.slice(-7).map(order=>order.date.slice(5));
	const max=Math.max(...values,100);
	const left=42;
	const bottom=height-35;
	const chartHeight=height-65;
	context.strokeStyle="#e8eaf2";
	context.lineWidth=1;
	for(let index=0;index<4;index++){const y=bottom-chartHeight*index/3;context.beginPath();context.moveTo(left,y);context.lineTo(width-12,y);context.stroke();}
	if(!values.length)return;
	context.beginPath();
	values.forEach((value,index)=>{const x=left+(width-left-20)*index/Math.max(values.length-1,1);const y=bottom-chartHeight*value/max;if(index===0)context.moveTo(x,y);else context.lineTo(x,y);context.fillStyle="#6658d3";context.font="11px Arial";context.fillText(labels[index],x-14,height-12);});
	context.strokeStyle="#6658d3";
	context.lineWidth=3;
	context.stroke();
	values.forEach((value,index)=>{const x=left+(width-left-20)*index/Math.max(values.length-1,1);const y=bottom-chartHeight*value/max;context.beginPath();context.arc(x,y,4,0,Math.PI*2);context.fillStyle="#ffffff";context.fill();context.strokeStyle="#6658d3";context.lineWidth=3;context.stroke();});
}
document.querySelector("#adminLogout").addEventListener("click",()=>{sessionStorage.removeItem("adminUser");window.location.href="index.html";});
window.addEventListener("resize",()=>loadAdmin());
loadAdmin().catch(error=>{document.querySelector("#adminOrders").innerHTML=`<tr><td colspan="5">${adminEscape(error.message)}</td></tr>`;});
