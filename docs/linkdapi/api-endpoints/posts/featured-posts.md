# API Documentation - LinkdAPI

## API Documentation

Professional data API for developers

[Getting Started](/docs/intro)[Pricing](/docs/endpoints-cost)

GET

## Featured Posts

[Try it](/playground?endpoint=%2Fapi%2Fv1%2Fposts%2Ffeatured&folder=Posts)

1 credit

Get all featured posts for a user by their URN.

`/api/v1/posts/featured?urn=ACoAAAKmquABM0LC0AnA3zMnfEZv2zSWO-gyUdk`

### Query Parameters

`urn`

Required

string

Example:`ACoAAAKmquABM0LC0AnA3zMnfEZv2zSWO-gyUdk`

### Response Schema

No schema available

### Example Response

InteractiveRaw JSONCode

success:true

statusCode:200

message:"Data retrieved successfully"

data:

\[0\]:

url:"https://www.linkedin.com/in/hnaser/details/featured/50064959/single-media-viewer"

imageUrl:"https://media.licdn.com/dms/image/v2/C562DAQEZ34GlamOkfw/profile-treasury-image-shrink\_800\_800/profile-treasury-image-shrink\_800\_800/0/1601651107572?e=1737043200&v=beta&t=N5gDDBREwT79J9N5xYXJECMR5v1WPG1CicMpzZ8XBwo"

reactions:null

likesCount:0

commentsCount:0

type:"Image"

title:"ESRI ArcGIS Server Code Challenge 2007"

text:"Award Winner of ArcGIS for Server Code Challenge in 2007, ESRI Developer Summit, http://esricodechallenge.wordpress.com/2007/03/21/and-the-winners-are"

\[1\]:

url:"https://www.linkedin.com/pulse/how-become-good-backend-engineer-fundamentals-hussein-nasser-9lxmc"

imageUrl:"https://media.licdn.com/dms/image/v2/D5612AQFxQPlDbA5TVw/article-cover\_image-shrink\_600\_2000/article-cover\_image-shrink\_600\_2000/0/1733190636331?e=1741824000&v=beta&t=dkOvpJRBlcHdjN5HgKCn0P\_AQ-sm989EVnf4M7DFleM"

reactions:null

likesCount:0

commentsCount:0

type:"Article"

title:"How to Become a Good Backend Engineer (Fundamentals)"

text:"I have been a backend engineer for over 20 years and I have witness technologies come and go. One thing however, always remains constant: The first principles the tech is built on. I don’t really mean tools, frameworks or even languages. Those evolve and change but the fundamental infrastructure on which the tools are built rarely does. For example knowing how to setup Apache or IIS is one thing, understanding the commonalities and differences between the two web servers is another. In this article I explore some of the fundamentals of backend engineering. that are at the root of everything we use. You may choose to have basic understanding of all these fundamentals and become a jack-of-all-trades backend engineer or go vertical in one at deeper level and become expert in that area. There is no wrong or right, it all depends on what moves you. The way to become a better backend engineer is never clean and straightforward. In fact, it is messy, it is full of trial and errors and experimentations that only you have to experience. There is no book, no course, no YouTube video or a medium article that can teach you everything there is about backend engineering. You have to experience it yourself. If you are a recent graduate interested in backend engineering, you may find one or more of these fundamentals interesting and decide to pursue it. The best way is to get your hands dirty. Let us get started. Communication Protocols Communications protocols link the frontend to the backend. Understanding how protocols work is a good skill to have for an engineer especially if they want to build a resilient backend application. Almost all the protocols we use and love on the backend are either built on top of TCP or UDP.That is why understanding the differences between this two help the engineer make the right choice. For instance, TCP is a stream-based connection-oriented protocol while UDP is a message based and connectionless. TCP provides reliable delivery at a cost of connection setup and retransmission. While UDP starts faster but doesn’t have guaranteed delivery. Anything you build on top of these two protocols must adhere to their fundamental properties. TCP is not better than UDP, and UDP is not better than TCP. It all depends on what you are building. Moving up the stack, the HTTP protocol was originally built on top of TCP because we wanted to send requests and responses reliably. As the web evolved and resources become richer, one connection was not sufficient to concurrently send multiple requests. So browsers started to establish more and more connections, the cost of connection setup for each request became so high. HTTP/2 introduced application level streams so multiple requests can be sent on the same connection. Later HTTP/2 evolved and had to be rewritten on top of UDP with HTTP/3 to solve the TCP head of line problem. There are reasons for everything, the fundamental feature of TCP was the culprit of this move. It doesn’t mean TCP is bad the web has evolved in a way that TCP is no longer suitable. If we didn’t know how TCP works we would not have improved the HTTP protocol. It is also important to know that using any protocol comes with a cost especially while building APIs. Understanding that cost will help you make better informed decisions. For example, using HTTP/2 might give you more HTTP request throughput, but the work the application needs to do to assemble the streams taxes the CPU, something Lucidchart learned the hard way. Sometimes the backend architecture requires real-time Bidirectional communication protocols to build chatting, gaming apps or just communicating between two services. Protocols such as WebSockets, gRPC or just raw TCP/UDP can be used. If you know how a protocol works and what is the strength and weaknesses you will know when to use it. Ultimately, learning communication protocols is important for a backend engineer, and it is possible to go as deep as desired in any protocol. Maybe one day you will write an RFC proposing a new protocol. Web Servers Web servers are becoming increasingly important as backend infrastructure relays on HTTP web communications. Web servers deliver static or dynamic content served on top of the HTTP protocol. If you build a Web API you may spin up your own web server in your language of choice or use a web framework such as Express or Django. Modern web servers support both HTTP/1.1 and HTTP/2. HTTP/3 is slowly getting support as its newer protocol. Configuring your web server with the appropriate protocol is critical for performance and resilience of your backend application; And it all depends on the environment. For example, Do you expect multiple concurrent requests from the same client? or do you expect fewer requests but from many clients? Based on that, you can pick multiplexing HTTP/2 or vanilla simple HTTP/1.1. The internal architecture of web servers can also differ. Web servers can be single or multithreaded. They can have one thread or multiple listener threads. There are many ways client connections can be accepted and distributed among the threads. If you choose an off-the-shelf web server you are stuck with its architecture. If you build your own from scratch you get to choose the architecture that is right for you. I wrote an article going through multiple designs for threading and connection management in backend servers, you may want to check it out. Additionally, web servers can set any where in the stack. For example, a CDN is a web server that acts like a cache and communicate with the origin backend web server to get the content. An API gateway is a web server that authenticate user and serve API responses from backend web servers. Examples of off-the-shelf web servers are Apache Tomcat, Apache httpd, and NGINX. The latter can act as both a web server and a proxy. You may build your own web server in any language by listening on a TCP port and understand how to speak the HTTP protocol, you can of course use an HTTP library that does most of the work for you. Database Engineering Database engineering is a vast field of study. At its core the idea of a database is simple; Allow multiple users to store and retreive data consistently and in a durable fashion. That is why understanding the four properties of ACID: atomicity, consistency, isolation, and durability is fundamental to database engineering. One must understand that nothing is written on stone and following these properties isn’t a must. For example, relational databases are fully ACID and require a schema while MongoDB was built as a document based database, with basic atomicity (document level) and no schema. Redis built a fanstatic high performance cache by sacrificing durability by default. No database system is complete without indexes and at their core B+Trees is the data structure of choice. How data is organized in tables, documents or graphs all end up as file system pages at the end of the day. Understanding how to get most of your disk I/O read is the core of database engineering. If you are interested in database engineering, there are many areas you can specialize in. You can pick one database and know everything about it. You can build a better indexing techniques (LSM is a good example). You can build a new database system specialized in a specific workload. I have been working with databases for 20 years and to this day I learn something new all the time. This field is vast. Proxies Proxies are becoming increasingly popular in the engineering world, especially with the introduction of micro-services. The main purpose of a proxy is it receives requests from a client and forward the requests to backend servers. The proxy hides the network layer identity of the original client from the destination server. There are two levels of proxying: layer 4 and layer 7 proxying. Layer 4 proxying works at the transport layer, while layer 7 proxying works at the application level. Each layer provides different capabilities and can be used for different purposes. Layer 7 proxying require the proxy to understand the application protocol while layer 4 proxying works with any application protocol because it works at the transport layer (TCP or UDP). You might have heard the forward proxy and reverse proxy used interchangeably. Both the forward proxy and the reverse proxy, receive requests from clients and forward the request to a backend. In the forward proxy, the client explicitly asks for a particular backend server and the proxy fulfills this request. Forward proxies must be configured in the client network proxy section for them to work. In the reverse proxy the client doesn’t know the final backend server, to the client the final destination is the reverse proxy. The client doesn’t know there are more servers on the backend. A common uses cases of proxies are caching, API gateways, authentication, load balancing and much more. For example a content delivery network (CDN) is a reverse proxy that sends request to the origin backends. Fiddler or MITM are proxies configured on the client side and all requests\* get sent to them first. Service meshes are essentially a proxy and a reverse proxy. Learn more about proxies here. \*I say all requests but in fact only requests that the proxy are configured to support. Mostly here we refer to HTTP proxy, so all HTTP requests get forwarded. Example of proxies are NGINX, HAProxy and Envoy. Proxies are one of the most interesting topics in backend engineering and one can specialize in learning and improving them. Cloudflare recently moved away from NGINX, their primary reverse proxy, and built their own proxy because of certain limitations in NGINX. I discussed that in details in an episode of the backend engineering show. Messaging Systems Messaging systems are becoming increasingly important as we move towards interconnected systems and services. As services start to communicate to each other, coupling and dependencies increase which increases the complexity of building scalable backend applications. Messaging systems are designed to remove this coupling Messaging systems at their core support a feature called publish-subscribe where a client can publish a message and other clients can subscribe to consume this content. The choice of architecting how publishing and consumption is made is up to the messaging system. For example, Kafka use long-polling model while RabbitMQ uses push model, both has pros and cons. Consuming a message also comes with an interesting and hard to solve problem. How do you make sure the consumer reads the message only once? These guarantees complicates the messaging system design. Messaging systems are truly interesting piece of technology that is fundamentals to backend engineering. This field might interest you. Message Formats Message formats go hand in hand with communication protocols; They describe in-wire format of the message being sent. They usually broken down into two types human readable and non-human readable. Examples are XML, JSON and protocol buffers. When a client sends a message to a backend, it needs to serialize the message from the language data structure to the on-wire message format. When the backend receives the message it needs to then deserialize the message from this format to the language data structure. That is why it is absoluity fine to have a Javascript client communicates with a C# backend using JSON as a message format. The native JSON object of javascript will be converted to a JSON byte string in the wire, the C# backend then deserializes the byte string to a C# structure representing a dictionary. It is important to understand the cost associated with serializing and deserializing message format. XML was one of the original message formats designed to be human-readable. However, computers had difficulty dealing with XMLs, so protocol buffers format was created to make the message format smaller and more friendly. Protocol buffers became very popular and were designed to solve the problem of high bandwidth messages. Protocol buffers minimize the payload so fewer bytes can be sent. It also speeds up the serialization and deserialization process. Becoming specialized in message formats is also an option. You may invent the next message format that may become the standard to serve us for the next 50 years. Security Security is an important topic in the field of software engineering. There are many different aspects to security. You can secure communications with encryption or TLS. You can prevent network intrusion with firewall rules and proper network configuration. You can study common software vulnerabilities and protect against denial of service attacks. As a software engineer, it is important to be familiar with the different types of security risks and how to mitigate them. One type of security risk is a man-in-the-middle attack. This is where an attacker intercepts communication between two parties and tries to eavesdrop or modify the data being exchanged. To prevent this type of attack, it is important to encrypt and authenticate the communicated parties using Transport Layer Security (TLS). Another type of security risk is a denial of service attack. This is where an attacker tries to prevent legitimate users from accessing a service by flooding it with requests or through finding a way to crash the backend by sending a special payload. To prevent this type of attack, it is important to have a firewall or a layer 7 DDOS protection layer in place to block illegitimate requests. Cloudflare has great services to detect DDOS traffic. This is of course made possible through layer 7 inspection. Of course its hard to summarize all possible security attacks. There is a client side security attacks such as XSS (cross side scripting), there are server side security attacks such as SQL injection. Security is an important topic in the field of software engineering. There are many aspects to security. As a software engineer, it is important to be familiar with the different types of security risks and how to mitigate them. Conclusion In conclusion, as a backend engineer, it is important to explore different technologies to find what interests you and where your strengths are. Don’t be afraid to experiment and build something cool, even if it’s with a language that may be considered unconventional. What we discussed in this article are what I believe are some of the fundamentals that will always remain here, understanding them makes you a better engineer. As you gain more experience and expertise, focus on deepening your knowledge in a specific area to become known for your skill in that field. Ultimately, it is important to follow your interests to succeed in the rapidly-evolving world of software engineering. Always remember, nothing is written in stone, you can change anything. There is no right and wrong way to design or build applications, it all depends on what you are trying to do. You may run into a situation where the technologies we have today work for you. But you might also reach a dead end and might need to invent something that has never been invented before. Just read the Homa paper, this protocol attempts to completely replaces the fundamental protocol TCP because data centers workloads are completely unsuitable for TCP. I hope you enjoyed this article. I wish you the best in your career. If you are interested to learn more about backend engineering consider getting my Fundamentals of Backend Engineering Udemy course"

\[2\]:

url:"https://www.linkedin.com/feed/update/urn:li:activity:6963946536233820161"

imageUrl:"https://media.licdn.com/dms/image/v2/C5622AQG15a0QKhyTCg/feedshare-shrink\_2048\_1536/feedshare-shrink\_2048\_1536/0/1660334236711?e=1739404800&v=beta&t=gvXo06iRpimyQsfACWnw7P3EFoPQR1kk1jHrFK1PP3g"

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:94

\[1\]:

reactionType:"INTEREST"

reactionCount:10

\[2\]:

reactionType:"EMPATHY"

reactionCount:5

likesCount:109

commentsCount:3

type:"Post"

title:""

text:"Congestion control is a collection of algorithms that controls the amount of data transmitted in a network by a sender in order to avoid flooding the networks with packets. Middle routers have buffers that hold the packets (segments to be exact) temporarily to be processed and routed to the next destination. When the buffer is filled up new packets will be dropped by those routers which causes an indication by the sender that some packets are getting lost. This signals a congestion of the network (new papers challenge definitions such as the Homa paper but it's outside the scope of this post) when a congestion is detected the congestion control slows down transmission by flipped between several algorithms. We discuss in this post the two major algorithms, the slow start and the congestion avoidance. The transmission starts with the slow start algorithm with an initial congestion window size of specific value (the CWND controls the congestion), the slow starts increases the CWND with 1 maximum segment size (around 1500 bytes in most cases) for each acknowledgment the sender gets. This continues until the CWND reaches the slow start threshold (SSTHRES) the algorithm then changes to the congestion avoidance. In the congestion avoidance algorithm, the CWND is increased by 1 MSS for each round trip (not each ack), this means if your CWND is 5 segments worth of size, sending 5 segments and getting acknowledgment for the entire 5 segments will get you an increase of 1 MSS to your CWND. This is as opposed to slow start where if you receive 5 acknowledgments you get +5 MSS to your CWND. That is why Slow Start starts slow but increases aggressively. While congestion avoidance increases slowly.  When congestion is detected , the slow start threshold is reduced by however many unacknowledged segments that are in flights (flight size) divided by two (not as commonly mistakenly CWND/2), Flight size is usually lower than CWND. The CWND is also reset to 1 MSS which then kicks back the slow start algorithm again since the CWND is lower than the slow start threshold. This goes on over and over again until the slow start threshold becomes equal or less than the value of 2MSS. The lower the slow start threshold the slower the increase of transmission because the slow start will reach the threshold faster and the congestion avoidance will kick in giving us linear increase.  In this video I explain the difference between the two algorithms and how they each take effect in transmission. If you enjoyed this post consider grabbing my fundamentals of network engineerings udemy course, I designed specifically for software engineers with top to bottom approach. Head to https://lnkd.in/gF\_h7q56 for a discount coupon #networkengineering #backendwebdevelopment #tcpip"

\[3\]:

url:"https://www.linkedin.com/feed/update/urn:li:activity:6860697305704742912"

imageUrl:"https://media.licdn.com/dms/image/v2/C5622AQHao4m1dW\_RUg/feedshare-shrink\_2048\_1536/feedshare-shrink\_2048\_1536/0/1635717701082?e=1739404800&v=beta&t=Z29Ial2fW5ezi1b\_6yrjs1XHOMV235hreJ3lsA16YiI"

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:142

\[1\]:

reactionType:"EMPATHY"

reactionCount:20

\[2\]:

reactionType:"PRAISE"

reactionCount:7

\[3\]:

reactionType:"APPRECIATION"

reactionCount:1

likesCount:170

commentsCount:9

type:"Post"

title:""

text:"I added some more content to my Introduction to Database Engineering based on feedback and requests it's now over 18 hours of pure database fundamentals, all for just $10.99 Head to https://lnkd.in/gYtaXGae which redirects to udemy with the $10.99 coupon already applied. If you enjoy my work, check out my NGINX and python course here https://lnkd.in/gw74zj3k https://lnkd.in/gpN6Szja"

\[4\]:

url:"https://www.linkedin.com/in/hnaser/details/featured/1582740105361/single-media-viewer"

imageUrl:"https://media.licdn.com/dms/image/sync/v2/C5627AQEvnQY0-XpCUw/articleshare-shrink\_800/articleshare-shrink\_800/0/1719486656696?e=1737043200&v=beta&t=TzlZ5VC2raaSwtOx1OH6E\_OK3sMzgwb8LXDkHEYS7SA"

reactions:null

likesCount:0

commentsCount:0

type:"Link"

title:"Learn GIS Programming with ArcGIS for Javascript API 4.x and ArcGIS Online: Learn GIS programming by building an engaging web map application works on mobile or the web"

text:"Build a web mapping application from scratch using ArcGIS Javascript API and ArcGIS Online. You will build an app that helps users locate landmarks. The app shows the landmarks in a map such as libraries, cafes, restaurants schools and much more. It..."

\[5\]:

url:"https://www.linkedin.com/feed/update/urn:li:activity:6962188683345104896"

imageUrl:"https://media.licdn.com/dms/image/v2/C5622AQEAFwI-oIlX\_Q/feedshare-shrink\_2048\_1536/feedshare-shrink\_2048\_1536/0/1659915131917?e=1739404800&v=beta&t=fgQuvPDeGo3TCLZRMBbuLgnA\_mPqOHoaU7nbMyrGHO8"

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:372

\[1\]:

reactionType:"INTEREST"

reactionCount:29

\[2\]:

reactionType:"EMPATHY"

reactionCount:5

\[3\]:

reactionType:"MAYBE"

reactionCount:4

\[4\]:

reactionType:"PRAISE"

reactionCount:2

likesCount:412

commentsCount:3

type:"Post"

title:""

text:"Index Seek vs Index Scan While this is mostly a SQL Server terminology, it is applicable to other DBMS platforms. An Index Seek traverses the B+Tree from the root node to look up a single value in a leaf page which causes at least 2 IOs depending on the depth of the B+Tree. An Index Scan however works by scanning the B+tree leaf pages which are ordered and linked, index scans are better suited for range queries or large values that are next to each other while seeks are great for more selective queries. Index Seek Example Students table ID has a b+tree index. SELECT \* FROM STUDENTS WHERE ID = 1 OR ID = 5003 or ID = 90000 That query will probably do 3 index seeks for each of the values on the index on the ID field. Index Scan Example SELECT \* FROM STUDENTS WHERE ID BETWEEN 1000 and 90000 That query will probably do a seek on the lowest range 1000 and then walk the linked leaf pages until we reach the page which has the entry 90000 thats when we the index scan stops. We can do that because we know that the entries in the pages are ordered and the pages linked (each page points to the next, a property of B plus Tree) Using a seek on every single value between 1000 and 90000 is probably going to be slower and results in more IO. While in the original example doing a scan from the page which has the value 1 to the page that has 90000 looking for 1, 5003 and 90000 is a complete waste of IO, (we will fetch pages in between that we don’t need ) Seek or Scan Example Here is where the planner might choose a different plan based on the inner query result SELECT \* FROM STUDENTS WHERE ID IN (SELECT ID FROM STUDENTS_GRADES WHERE GRADE > 90 ) The inner query here might return IDs all over the place. It might also return a single value. As a result it might be a scan or a seek. The question here how do you know which is better? The planner tries its best but at the end of the day it may miss and pick the wrong plan. So it is up to us to write our queries in a predictable way if possible. I know that is not always the case but knowing what is happening behind the scenes is the first step. For those interested to learn more about fundamentals of database engineering like this one grab a copy of my udemy course and discount coupon here https://lnkd.in/gYtaXGae"

\[6\]:

url:"https://www.linkedin.com/feed/update/urn:li:activity:6849751510591635456"

imageUrl:"https://media.licdn.com/dms/image/v2/C5622AQEyzcsYdr09eQ/feedshare-shrink\_2048\_1536/feedshare-shrink\_2048\_1536/0/1633108021926?e=1739404800&v=beta&t=QBZXHmHIb5fg8OltVoQ9N71cwyYUOggF7bjsjJ\_x\_aY"

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:26

\[1\]:

reactionType:"EMPATHY"

reactionCount:1

likesCount:27

commentsCount:1

type:"Post"

title:""

text:"Microsoft added few more options in IIS binding in the latest update. Will cover them in the next show"

\[7\]:

url:"https://www.linkedin.com/in/hnaser/details/featured/1582740326030/single-media-viewer"

imageUrl:""

reactions:null

likesCount:0

commentsCount:0

type:"Document"

title:"The !Empathetic Engineer.pdf"

text:"Engineers are incredibly smart people. This could be a product of the complex problems they usually work on and the abundance of solutions a given problem can have. This is especially true for software engineering problems. With so many roads leading to Rome, it becomes attractive for engineers to favor the idea they came up with over others. This book is what you should not strive to be."

\[8\]:

url:"https://www.linkedin.com/pulse/avoid-select-even-single-column-tables-hussein-nasser-cjakc"

imageUrl:"https://media.licdn.com/dms/image/v2/D5612AQFjLvDF\_2luwQ/article-cover\_image-shrink\_600\_2000/article-cover\_image-shrink\_600\_2000/0/1731535238748?e=1741824000&v=beta&t=bhQfWp6dGU67qCZ2mBuVeMp9MeduSQ66RSlUUeKwNGw"

reactions:null

likesCount:0

commentsCount:0

type:"Article"

title:"Avoid SELECT \*, even on a single-column tables"

text:"Try avoiding SELECT \* even on single-column tables. Just keep that in mind even if you disagree. By the end of this article, I might have you contemplate. A story from 2012 This is a true story I ran into with a customer backend application over 12 years ago (circa 2012-2013). A backend API that is stable and runs in single digit millisecond. One day users came in to a slow and sluggish user experience. We checked the commits and nothing was obvious, most changes were benign. Just in case we reverted all commits (Some of you might relate to this, you know you are getting desperate if you blame things that don't make sense). However, the app was still slow. Looking at the diagnostics, we noticed API response time is taking from 500 ms to up to 2 seconds at times. Where it used to be single-digit millisecond. We know nothing has changed in the backend that would’ve cause the slow down, but started looking at the database queries. SELECT \* on a table that has 3 blob fields are being returned to the backend app, those blob fields has very large documents. It turned out this table had only 2 integer columns, and the API was running a SELECT \* to return and use the two fields. But later, the admin added 3 blob fields that are used and populated by another application. While those blob fields were not being returned to the client, the backend API took the hit pulling the extra fields populated by other applications, causing database, network and protocol serialization overhead. How database reads work In a row-store database engine, rows are stored in units called pages. Each page has a fixed header and contains multiple rows, with each row having a record header followed by its respective columns. For instance, consider the following example in PostgreSQL: When the database fetches a page and places it in the shared buffer pool, we gain access to all rows and columns within that page. So, the question arises: if we have all the columns readily available in memory, why would SELECT \* be slow and costly? Is it really as slow as people claim it to be? And if so why is it so? In this post, we will explore these questions and more. Kiss Index-Only Scans Goodbye Using SELECT \* means that the database optimizer cannot choose index-only scans. For example, let’s say you need the IDs of students who scored above 90, and you have an index on the grades column that includes the student ID as a non-key, this index is perfect for this query. However, since you asked for all fields, the database needs to access the heap data page to get the remaining fields increasing random reads resulting in far more I/Os. In contrast, the database could have only scanned the grades index and returned the IDs if you hadn’t used SELECT \*. Deserialization Cost Deserialization, or decoding, is the process of converting raw bytes into data types. This involves taking a sequence of bytes (typically from a file, network communication, or another source) and converting it back into a more structured data format, such as objects or variables in a programming language. When you perform a SELECT \* query, the database needs to deserialize all columns, even those you may not need for your specific use case. This can increase the computational overhead and slow down query performance. By only selecting the necessary columns, you can reduce the deserialization cost and improve the efficiency of your queries. Not All Columns Are Inline One significant issue with SELECT queries is that not all columns are stored inline within the page. Large columns, such as text or blobs, may be stored in external tables and only retrieved when requested (Postgres TOAST tables are example). These columns are often compressed, so when you perform a SELECT query with many text fields, geometry data, or blobs, you place an additional load on the database to fetch the values from external tables, decompress them, and return the results to the client. Network Cost Before the query result is sent to the client, it must be serialized according to the communication protocol supported by the database. The more data needs to be serialized, the more work is required from the CPU. After the bytes are serialized, they are transmitted through TCP/IP. The more segments you need to send, the higher the cost of transmission, which ultimately affects network latency. Returning all columns may require deserialization of large columns, such as strings or blobs, that clients may never use. Client Deserialization Once the client receives the raw bytes, the client app must deserialize the data to whatever language the client uses, adding to the overall processing time. The more data is in the pipe the slower this process. Unpredictability Using SELECT on the client side even if you have a single field can introduce unpredictability. Think of this example, you have a table with one or two fields and your app does a SELECT , blazing fast two integer fields. However, later the admin decided to add an XML field, JSON, blob and other fields that are populated and used by other apps. While your code did not change at all, it will suddenly slow down because it is now picking up all the extra fields that your app didn’t need to begin with. Code Grep Another advantage of explicit SELECT is you can grep the codebase for in columns that are in use columns, so in case if you want to rename or drop a column. This makes database schema DDL changes more approachable. Summary In conclusion, a SELECT query involves many complex processes, so it’s best to only select the fields you need to avoid unnecessary overhead. Keep in mind that if your table has few columns with simple data types, the overhead of a SELECT query might be negligible. However, it’s generally good practice to be selective about the columns you retrieve in your queries. If you enjoyed this article check out my Backend and Database courses, link in bio."

\[9\]:

url:"https://www.linkedin.com/feed/update/urn:li:activity:7208542528852172800"

imageUrl:"https://media.licdn.com/dms/image/v2/D5622AQHvO47nFq1YeA/feedshare-shrink\_2048\_1536/feedshare-shrink\_2048\_1536/0/1718650466630?e=1739404800&v=beta&t=ZawT9WSSlE4Fbto7Le0B4a9nSqyN1n1lfURR9z3N\_Fw"

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:324

\[1\]:

reactionType:"EMPATHY"

reactionCount:41

\[2\]:

reactionType:"INTEREST"

reactionCount:7

\[3\]:

reactionType:"PRAISE"

reactionCount:6

\[4\]:

reactionType:"APPRECIATION"

reactionCount:3

likesCount:381

commentsCount:11

type:"Post"

title:""

text:"List of all courses in a single link (with coupons) The order is optional. (pinned post) https://lnkd.in/gqbKm7kz"

\[10\]:

url:"https://www.linkedin.com/feed/update/urn:li:activity:7004607875545272320"

imageUrl:"https://media.licdn.com/dms/image/sync/v2/C5627AQGJijX32gdo-g/articleshare-shrink\_800/articleshare-shrink\_800/0/1711200600470?e=1737043200&v=beta&t=9DWG4IsAAWdVPo8etmZ6lstGbqUfhTkginVahQD4\_Qs"

reactions:

\[0\]:

reactionType:"LIKE"

reactionCount:2160

\[1\]:

reactionType:"EMPATHY"

reactionCount:151

\[2\]:

reactionType:"INTEREST"

reactionCount:139

\[3\]:

reactionType:"PRAISE"

reactionCount:16

\[4\]:

reactionType:"APPRECIATION"

reactionCount:11

\[5\]:

reactionType:"MAYBE"

reactionCount:5

likesCount:2482

commentsCount:34

type:"Post"

title:"How to Become a Good Backend Engineer (Fundamentals)"

text:"How to Become a Good Backend Engineer I have been a backend engineer for over 18 years and I witnessed technologies come and go but one thing always remain constant; The first principals the tech is built on. I don’t really mean tools, frameworks or even languages. Those evolve and change but the fundamental infrastructure on which these tool are built rarely does. For example knowing how to setup Apache or IIS is one thing, understanding the commonalities and differences between the two web servers is another. In this article I explore some of the fundamentals of backend engineering that are at the root of everything we use. You may choose to have basic understanding of all these fundamentals and become a jack-of-all-trade backend engineer or go vertical in one at deeper level and become expert in that area. There is no wrong or right, it all depends on what moves you. Read full article here https://lnkd.in/gTbiygiQ #engineering #softwaredevelopment #backendwebdevelopment"

\[11\]:

url:"https://www.linkedin.com/feed/update/urn:li:activity:6968061048385912832"

imageUrl:""

reactions:null

likesCount:0

commentsCount:0

type:"Post"

title:"7 HTTPS configurations"

text:"HTTPS is used to encrypt the communication between th client and server. There are many configurations that HTTPs can be in which affects latency and performance. In this post I explore 7 of the configurations. 1. HTTPS over TCP 1.2 Common with HTTP/1.1 and HTTP/2 protocols since those use the TCP transport. First client establishes a TCP connection with three way handshake (SYN/SYN-ACK/ACK), followed by TLS1.2 handshake which envolves the client providing the server with a buffet of cipher suites options and the key exchanges algorithms in a client hello message, the server responding with the symmetric algorithm and key exchange algorithm plus certificate. The client then prepares private and public key exchange parameters based on the agreed key exchange algorithm and symmetric encryption. shares the public part with the server, the server does the same and both finally have the symmetric key. The client then uses the symmetric key to encrypt the GET request, which the server decrypts with the same key. Server processes the request, produces a response, encrypts it with the key and sends it to the client. 2. HTTPS over TCP with TLS 1.3 Common with HTTP/1.1 and HTTP/2, the server and the client can support TLS 1.3 which allows for a shorter TLS handshake. We still do the TCP 3 way handshake followed by a client hello, in this the client assumes a key exchange algorithm (Elliptic curve for e.g. , generates the parameters and send it , no more buffet of options, the options are limited to secure ciphers. The server receives the key exchange parameters and immediately can generate the symmetric key, it picks a cipher, sends the server hello with certificate for authentication, with the chosen cipher (say AES) and its parts of key exchange. the client now can complete the key and starts sending the GET request encrypted. Saving a whole round trip. 3. HTTPS over TCP with TLS 1.3 and 0RTT Same as 2 but the client uses a preshared key from a prior session to immediately encrypt the communication. No TLS round trip in this case thus 0RTT. Still we had to eat the 3 way handshake for TCP. 4&5. HTTPS over TCP fast open with TLS 1.3 /0RTT TCP fast open allows client to send data during the SYN if a prior communication did happen with the server which generated a cookie. The client sends the TFO (TCP Fast Open ) cookie with SYN along with the data which can be TLS client hello saving a whole round trip. (P.s never seen this in the wild but I don’t see why they aren’t possible. ) 6&7. HTTPS over QUIC (HTTP/3) /0RTT We enter HTTP/3 where QUIC as a transport protocol gives you both transport with single round trip encryption. And because it was built from scratch the connection handshake and encryption is done in one round trip. Followed by the encrypted request. QUIC encryption is similar to TLS 1.3. Hope you enjoyed this post, learn more about fundamentals of network engineering grab my udemy course https://lnkd.in/gF\_h7q56"
