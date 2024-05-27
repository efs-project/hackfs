var currentTopic;
var parentTopic;
var currentChainId;
let schemas = {
    "0xddc07ff085923cb9a3c58bf684344b7672881e5a004044e3e99527861fed6435": {
        "name": "topic",
        "display": "Subtopics",
        "properties": [
            {
                "name": "topic",
                "display": "Topic",
                "type": "string",
                "formType": "text"
            }
        ]
    },
    "0xe5abe9a6766fbf5944829bb25cc023cc3c7b3b2326acd9b6047cc019960e0b01": {
        "name": "property",
        "display": "Properties",
        "properties": [
            {
                "name": "name",
                "display": "Name",
                "type": "string",
                "formType": "text"
            },
            {
                "name": "value",
                "display": "Value",
                "type": "string",
                "formType": "text"
            },
            {
                "name": "mediaType",
                "display": "Media Type",
                "type": "string",
                "formType": "text"
            },
            {
                "name": "Offchain",
                "display": "Is Offchain? (IPFS)",
                "type": "bool",
                "formType": "checkbox"
            }
        ]
    },
    "0x3969bb076acfb992af54d51274c5c868641ca5344e1aacd0b1f5e4f80ac0822f": {
        "name": "message",
        "display": "Messages",
        "properties": [
            {
                "name": "message",
                "display": "Message",
                "type": "string",
                "formType": "text"
            }
        ]
    }
};
const gotoTopic = async (topicId)=>{
    history.pushState({
        "topicId": topicId
    }, "", window.location.href + "/" + await topicIdToName(topicId));
    loadTopic(topicId);
};
const loadTopic = async (topicId)=>{
    document.getElementById("topicPath").innerHTML = "Loading...";
    document.getElementById("app").innerHTML = "";
    Object.keys(schemas).forEach((schemaId)=>{
        let schemaView = document.createElement("div");
        schemaView.id = "View" + schemaId;
        schemaView.classList.add("schemaView");
        let h2 = document.createElement("h2");
        h2.textContent = schemas[schemaId].display + " ";
        let span = document.createElement("span");
        span.classList.add("createAttestation");
        let a = document.createElement("a");
        a.href = "";
        a.onclick = (event)=>{
            event.preventDefault();
            openAttestationEditor(schemaId);
        };
        a.textContent = "[Create New]";
        span.appendChild(a);
        h2.appendChild(span);
        schemaView.appendChild(h2);
        let list = document.createElement("div");
        list.id = "List" + schemaId;
        schemaView.appendChild(list);
        document.getElementById("app").appendChild(schemaView);
    });
    document.getElementById("topicPath").innerHTML = await getParentTopics(topicId);
    document.getElementById("List0xddc07ff085923cb9a3c58bf684344b7672881e5a004044e3e99527861fed6435").innerHTML = await loadTopicList(topicId);
    let properties = await loadProperties(topicId);
    if (properties.length === 0) {
        document.getElementById("List0xe5abe9a6766fbf5944829bb25cc023cc3c7b3b2326acd9b6047cc019960e0b01").innerHTML = "No properties found.";
        return;
    } else {
        let table = document.createElement("table");
        properties.forEach((property)=>{
            let row = document.createElement("tr");
            let cell1 = document.createElement("td");
            cell1.textContent = property.decodedDataJson[0].value.value;
            cell1.classList.add("propName");
            row.appendChild(cell1);
            let cell2 = document.createElement("td");
            cell2.textContent = property.decodedDataJson[1].value.value;
            cell2.classList.add("propValue");
            row.appendChild(cell2);
            table.appendChild(row);
        });
        document.getElementById("List0xe5abe9a6766fbf5944829bb25cc023cc3c7b3b2326acd9b6047cc019960e0b01").appendChild(table);
    }
    let messages = await getMessagesForTopic(topicId, 3);
    if (messages.length === 0) document.getElementById("List0x3969bb076acfb992af54d51274c5c868641ca5344e1aacd0b1f5e4f80ac0822f").innerHTML = "No properties found.";
    else document.getElementById("List0x3969bb076acfb992af54d51274c5c868641ca5344e1aacd0b1f5e4f80ac0822f").innerHTML = messages;
    currentTopic = topicId;
};
const search = async ()=>{
    var topic = document.getElementById("search").value;
    loadTopic(topic);
};
const openAttestationEditor = async (schemaId)=>{
    var attestationEditor = document.getElementById("New" + schemaId);
    if (attestationEditor == null) {
        attestationEditor = document.createElement("div");
        attestationEditor.id = "New" + schemaId;
        document.getElementById("List" + schemaId).prepend(attestationEditor);
        attestationEditor.innerHTML = "<h3>New " + schemas[schemaId].name + "</h3>";
        schemas[schemaId].properties.forEach((property)=>{
            attestationEditor.innerHTML += property.display + ": <input id='" + property.name + "' type='" + property.formType + "'><br />";
        });
        attestationEditor.innerHTML += "<button onclick='callCreateAttestation(\"" + schemaId + "\")'>Create</button></div>";
        attestationEditor.toggleAttribute("hidden");
    }
    attestationEditor.toggleAttribute("hidden");
};
const callCreateAttestation = async (schemaId)=>{
    let data = {};
    let inputs = document.querySelectorAll(`#New${schemaId} input`);
    inputs.forEach((input)=>{
        if (input.type === "checkbox") {
            data[input.id] = input.checked;
            input.checked = false;
        } else {
            data[input.id] = input.value;
            input.value = "";
        }
    });
    createAttestation(schemaId, data, currentTopic);
    document.getElementById("New" + schemaId).toggleAttribute("hidden");
};
let map = {
    "11155111": "0xaa36a7",
    "0xaa36a7": "0xaa36a7",
    "sepolia": "0xaa36a7"
};
function getChainId(theString) {
    return map[theString];
}
document.addEventListener("DOMContentLoaded", (event)=>{
    let topicId = "";
    let url = new URL(window.location.href);
    let pathSegments = url.hash.split("/").filter((segment)=>segment !== "");
    (async function() {
        if (pathSegments.length === 0) {
            currentChainId = "0xaa36a7"; // default to Sepolia
            topicId = "0x6e4851b1ee4ee826a06a4514895640816b4143bf2408c33e5c1263275daf53ce"; // root topic for Sepolia
            console.log(`Loading defaults ${currentChainId} ${topicId}`);
        } else {
            pathSegments.forEach((segment)=>{
                if (segment.startsWith("#")) {
                    currentChainId = getChainId(segment.substring(1).toLocaleLowerCase());
                    if (currentChainId === undefined) {
                        console.log(`Unknown chain id ${segment}`);
                        currentChainId = "0xaa36a7";
                    }
                    pathSegments = pathSegments.filter((segment)=>!segment.startsWith("#"));
                }
            });
            topicId = await topicPathToId(pathSegments);
        }
        history.replaceState({
            "topicId": topicId
        }, "", document.location.href);
        loadTopic(topicId);
    })();
});
window.addEventListener("popstate", (event)=>{
    // If a state has been provided, we have a "simulated" page
    // and we update the current page.
    console.log(`popstate `, event);
    if (event.state) {
        // Simulate the loading of the previous page
        console.log(event.state);
        console.log(event);
        let topic = event.state.topicId;
        console.log(`Loading topic ${topic}`);
        loadTopic(topic);
    }
});

//# sourceMappingURL=index.3db6400f.js.map
