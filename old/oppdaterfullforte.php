<?php
foreach ($_POST AS $field => $value){
$$field = $value;
}

$sql_STRING = getenv("QUERY_STRING");
$SCRIPT_NAME = getenv("SCRIPT_NAME");


// Connecting, selecting database
$conn = new mysqli('localhost', '', '', '');
// check connection
if ($conn->connect_error) {
  trigger_error('Database connection failed: '  . $conn->connect_error, E_USER_ERROR);
}

mysqli_query($conn, "SET NAMES 'utf8' COLLATE 'utf8_general_ci'");

?>

<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><title>Oppdatere antall fullførte</title>
</head>

<body>
<h1>Oppdatere antall fullførte</h1>

        
          
<?php

switch ($action) {
/////////////////////// BACKUP //////////////////////////////////
case "backup":

print "<p>Tar backup av database...\n\n";

$fp = fopen('temp/before'.$year.'-'.$eventid.'-'.date("YmdHis").'.csv', 'w');

$sql = "SELECT * FROM fullfort";

    $result=$conn->query($sql);
 
    if($result === false) {
      trigger_error('Wrong SQL: ' . $sql . ' Error: ' . $conn->error, E_USER_ERROR  );
    } else {
      //$rows_returned = $result->num_rows;
      $arr = $result->fetch_all(MYSQLI_ASSOC);
    }
    
foreach ($arr as $val) {
    fputcsv($fp, $val);
}

fclose($fp);

//$result = mysql_query($backupsql) or die('Query failed: ' . mysql_error());
//while ($rs = mysql_fetch_array($result, MYSQL_NUM)) {
//  fputcsv($fp, $rs);
//}
//mysql_free_result($result);
//fclose($fp);


?>

<p>Backup OK!

<form action="<?php echo $SCRIPT_NAME; ?>" method="post">
<input type=hidden name="action" value="parse">
<input type=hidden name="year" value="<?php echo $year; ?>">
<input type=hidden name="eventid" value="<?php echo $eventid; ?>">
<input type="submit" value="Start resultatgjennomgang">
</form>
<?php


break;
/////////////////////// PARSE //////////////////////////////////
case "parse":

?>
<p>År: 
<?php echo $year; ?></p>

<p>
<p>Event-ID: 
<?php echo $eventid; ?></p>

<p>

<form action="<?php echo $SCRIPT_NAME; ?>" method="post">
<input type=hidden name="action" value="save">
<input type=hidden name="year" value="<?php echo $year; ?>">
<input type=hidden name="eventid" value="<?php echo $eventid; ?>">

<table border="0" cellpadding="2" cellspacing="0">

<?php 

define('EVENTOR_API_BASE_URL', "https://eventor.orientering.no/api/");

# Caching
$cache = dirname(__FILE__) . '/temp/cache'.$eventid.'.xml';
$oldness=60*60*24*10; # Cache time
$maxentries=20; # Max number of entries to show

$data="";

# Use cache depending on how old cache data is
if(filemtime($cache) < (time() - $oldness)) {

# Get data from Eventor
$url = EVENTOR_API_BASE_URL . "results/event?eventId=".$eventid;
$xml = eventorApiCall($url);

# Write to cachefile
$cachefile = fopen($cache, 'wb');
fwrite($cachefile, $xml);
fclose($cachefile);

}
else {

$cachefile = fopen($cache, "r");
$xml = fread($cachefile, filesize($cache));
fclose($cachefile);


}


$doc=simplexml_load_string($xml);

$ii=0;
$classResultNodes = $doc->xpath("//ClassResult");   

if ($requestedclasse == "") {
  $requestedclassetmp = $doc->xpath("//ClassResult/EventClass/ClassShortName");
  $requestedclasse = $requestedclassetmp[0];
}
print "<p>Klasse1! " . $requestedclassetmp[0] . "</p>";
print "<p>Klasse2! " . $requestedclasse . "</p>";

foreach($classResultNodes as $classResultNode)   
{
//  $EventClassId=$classResultNode->xpath("EventClass/EventClassId");
  $ClassShortName=$classResultNode->xpath("EventClass/ClassShortName");
  $CourseLength=$classResultNode->xpath("EventClass/ClassRaceInfo/CourseLength");
  $ModifyDateDate=$classResultNode->xpath("EventClass/ModifyDate/Date");
  $ModifyDateClock=$classResultNode->xpath("EventClass/ModifyDate/Clock");
  $personResultNodes=$classResultNode->xpath("PersonResult");

//  print "<p><hr><pre>";
//  print $ClassShortName[0][0] . " - " . $CourseLength[0][0] . " Modified " . $ModifyDateDate[0][0] . " " . $ModifyDateClock[0][0] . "\n";
  
  if ($ClassShortName[0][0] == $requestedclasse) {

    print "<tr><td>" . $ClassShortName[0][0] . "<input type=hidden name=\"classe\" value=\"" . $ClassShortName[0][0] . "\"></td></tr>\n";

    foreach($personResultNodes as $personResultNode)   
    {
      $FamilyName=$personResultNode->xpath("Person/PersonName/Family");
      $GivenName=$personResultNode->xpath("Person/PersonName/Given");
      $PersonID=$personResultNode->xpath("Person/PersonId");
      $Club=$personResultNode->xpath("Organisation/Name");
      $ResultPosition=$personResultNode->xpath("Result/ResultPosition");
      $CompetitorStatus=$personResultNode->Result->CompetitorStatus->attributes()->value;
      $ResTime=$personResultNode->xpath("Result/Time");
      $TimeDiff=$personResultNode->xpath("Result/TimeDiff");
      print "<!--";
      print $ResultPosition[0][0] . " " . $PersonID[0][0] . " " . $GivenName[0][0] . " " . $FamilyName[0][0] . " " . $Club[0][0] . " " . $ResTime[0][0] . " " . $TimeDiff[0][0] . " " . $CompetitorStatus[0][0][0][0];    
      print "-->\n";
      
    ///////////      
          
      if ($CompetitorStatus[0][0][0][0] == "OK") {
      
        $n++;
      
        $fullname = $FamilyName[0][0] . " " . $GivenName[0][0];
      
        $names = explode(" ", $fullname);

        $curreventorid = intval($PersonID[0][0]);
        if ($curreventorid == "0") {
          $curreventorid = "99999999";
        }

        
        print "<tr><td nowrap bgcolor=#ffcc00>";
        print "<select name=update" . $n . "><option value=yes selected>Oppdater</option><option value=no>Behold</option></select></td>";
        print "<td nowrap bgcolor=#ffcc00><b>" . $GivenName[0][0] . " " . $FamilyName[0][0] . "</b><input type=hidden name=\"name" . $n . "\" value=\"" . $fullname . "\"> : " . $Club[0][0] . "<input type=hidden name=\"club" . $n . "\" value=\"" . $Club[0][0] . "\"><input type=hidden name=\"eventorid" . $n . "\" value=\"" . intval($PersonID[0][0]) . "\"></td>\n";

        $alreadySuggested = ",";
        
      
        // Finne records hvor Eventor-ID stemmer
        $sql[0] = "SELECT ID2, EVENTORID, concat(FIRSTNAME, ' ', SURNAME) AS FULLNAME, CLUB FROM fullfort WHERE EVENTORID = " . $curreventorid;
        // Finne records hvor navn og klubb stemmer
        $sql[1] = "SELECT ID2, EVENTORID, concat(FIRSTNAME, ' ', SURNAME) AS FULLNAME, CLUB FROM fullfort WHERE concat(FIRSTNAME,' ',SURNAME) = '" . $GivenName[0][0] . " " . $FamilyName[0][0] . "' and CLUB = '" . $Club[0][0] . "'";
        // Finne records hvor navn stemmer
        $sql[2] = "SELECT ID2, EVENTORID, concat(FIRSTNAME, ' ', SURNAME) AS FULLNAME, CLUB FROM fullfort WHERE concat(FIRSTNAME,' ',SURNAME) = '" . $GivenName[0][0] . " " . $FamilyName[0][0] . "'";
        // Finne records hvor første fornavn og klubb stemmer
        $sql[3] = "SELECT ID2, EVENTORID, concat(FIRSTNAME, ' ', SURNAME) AS FULLNAME, CLUB FROM fullfort WHERE concat('   ', SURNAME, '   ', FIRSTNAME, '   ') LIKE '% " . $names[1] . " % '  and CLUB = '" . $Club[0][0] . "'";
        // Finne records hvor etternavn og f�rste fornavn stemmer, i vilk�rlig rekkef�lge
        $sql[4] = "SELECT ID2, EVENTORID, concat(FIRSTNAME, ' ', SURNAME) AS FULLNAME, CLUB FROM fullfort WHERE concat('   ', SURNAME, '   ', FIRSTNAME, '   ') LIKE '% " . $names[0] . " % " . $names[1] . "% ' or concat('   ', SURNAME, '   ', FIRSTNAME, '   ') LIKE '% " . $names[1] . " % " . $names[0] . "% '";
        // Finne records hvor etternavn og klubb stemmer            
        $sql[5] = "SELECT ID2, EVENTORID, concat(FIRSTNAME, ' ', SURNAME) AS FULLNAME, CLUB FROM fullfort WHERE concat('   ', SURNAME, '   ', FIRSTNAME, '   ') LIKE '% " . $names[0] . " % '  and CLUB = '" . $Club[0][0] . "'";

        $textcolor = "";
        
        print "  </tr>\n";
        print "  <tr><td nowrap><input type=radio name=\"mergeid" . $n . "\" value=\"new\">Legg til ny</td>\n";
      
        for ($i = 0; $i < count($sql); $i++) {
//          print "<!--                                " . $sql[$i] . "-->\n";
          $result=$conn->query($sql[$i]);
//          $result = mysql_query($sql[$i]) or die('Query failed: ' . mysql_error());

 
    if($result === false) {
      trigger_error('Wrong SQL: ' . $sql[$i] . ' Error: ' . $conn->error, E_USER_ERROR  );
    } else {
      //$rows_returned = $result->num_rows;
      $arr = $result->fetch_all(MYSQLI_ASSOC);
    }
    
    foreach($arr as $rs) {
        //          while ($rs = mysql_fetch_array($result, MYSQL_ASSOC)) {
            if (strpos($alreadySuggested, "," . $rs["ID2"] . ",") === false) {
//              print "<!--      " . $i . " )  ff=" . $rs["ID2"] . " ev="  . $rs["EVENTORID"] . " "  . $rs["FULLNAME"] . " "  . $rs["CLUB"] . "-->\n";
              print "  <td nowrap><input type=radio name=\"mergeid" . $n . "\" value=\"" . $rs["ID2"] . "\">";
              print $textcolor . "(" . $i . ") " . $rs["ID2"] . ": " . $rs["FULLNAME"] . ", " . $rs["CLUB"] . "</td>\n";
              $alreadySuggested = $alreadySuggested . $rs["ID2"] . ",";
            }
          }
          $textcolor = "<font color=#" . dechex($i*3) . dechex($i*3) . dechex($i*3) . dechex($i*3) . dechex($i*3) . dechex($i*3) . ">";
          //mysql_free_result($result);
        }
        print "</tr>\n";

      }

      $requestedclasse = "recordnextclasse";
    }
    
    ?>
      <tr><td colspan=2>
        <input type="hidden" name="entries" value="<?php print $n; ?>">
        <input type="submit" value="Lagre til database">
      </td></tr>
    <?php      
    
  }
  elseif ($requestedclasse == "recordnextclasse") {
    $requestedclasse = "pleasejustendnow";
    ?>
      <tr><td>
        <input type=hidden name="requestedclasse" value="<?php print $ClassShortName[0][0]; ?>">
      </td></tr>
    <?php
  }
  
//  print "</pre></p>";
}


?>


</table>
</form>





<?php 
break;
/////////////////////// SAVE //////////////////////////////////
case "save":

  print "<p>Entries: " . $entries;
  print "<ul>";
 
  for ($i = 1; $i <= $entries; $i++) {
    print "<li>" . $_POST["update".$i] . " " .  $_POST["name".$i] . " " . $_POST["club".$i] . " " . $_POST["classe"] . " " . $_POST["year"] . " " . $_POST["mergeid".$i] . " ev=" . $_POST["eventorid".$i] . "\n";

    if ($_POST["mergeid".$i] == "") {
      print "<small><ul><li>Ingen valg! Da velger jeg selv: Legger til ny.</ul></small>";
      $sqlSave = "INSERT INTO fullfort (COUNT, EVENTORID, SURNAME, FIRSTNAME, CLUB, fullfort." . $_POST["year"] . ") VALUES ('1', '" . $_POST["eventorid".$i] . "','" . substr($_POST["name".$i], 0, strpos($_POST["name".$i], " ")) . "', '" . substr($_POST["name".$i], strpos($_POST["name".$i], " ")) . "', '" . $_POST["club".$i] . "', '" . $_POST["classe"] . "')";
    }
    elseif (is_numeric($_POST["mergeid".$i])) {
      if ($_POST["update".$i] == "no") {
        print "<small><ul><li>Oppdaterer eksisterende uten å oppdatere navn og klubb.</ul></small>";
        $sqlSave = "UPDATE fullfort SET fullfort." . $_POST["year"] . "='" . $_POST["classe"] . "', EVENTORID='" . $_POST["eventorid".$i] . "'  WHERE ID2 = " . $_POST["mergeid".$i];
      }
      else {
        print "<small><ul><li>Oppdaterer eksisterende, med ny navn, klubb, etc.</ul></small>";
        $sqlSave = "UPDATE fullfort SET fullfort." . $_POST["year"] . "='" . $_POST["classe"] . "', EVENTORID='" . $_POST["eventorid".$i] . "', SURNAME='" . substr($_POST["name".$i], 0, strpos($_POST["name".$i], " ")) . "' , FIRSTNAME='" . substr($_POST["name".$i], strpos($_POST["name".$i], " ")) . "' , CLUB='" . $_POST["club".$i] . "' WHERE ID2 = " . $_POST["mergeid".$i];
      }
    }
    else {
      print "<small><ul><li>Legger til en ny record.</ul></small>";
      $sqlSave = "INSERT INTO fullfort (COUNT, EVENTORID, SURNAME, FIRSTNAME, CLUB, fullfort." . $_POST["year"] . ") VALUES ('1', '" . $_POST["eventorid".$i] . "','" . substr($_POST["name".$i], 0, strpos($_POST["name".$i], " ")) . "', '" . substr($_POST["name".$i], strpos($_POST["name".$i], " ")) . "', '" . $_POST["club".$i] . "', '" . $_POST["classe"] . "')";
    }
    
    print "<small><ul><li>" . $sqlSave . "</ul></small>\n";

    
    // LAGRE TIL DATABASE 
    $result=$conn->query($sqlSave);  
   if($result === false) {
      trigger_error('Wrong SQL: ' . $sqlSave . ' Error: ' . $conn->error, E_USER_ERROR  );
    }    
    
//    $result = mysql_query($sqlSave) or die('Query failed: ' . mysql_error());
//    mysql_free_result($result);  

    
  }
  
  
  
 
  print "</ul>\n\n<p>Lagret!</p>\n";

  if ($_POST["requestedclasse"] == "") {

?>
<p>Det var alle resultatene for <?php print $year; ?>! Da gjenstår det bare å ...</p>
<form action="<?php print $SCRIPT_NAME; ?>" method="post">
<input type=hidden name="action" value="updatecount">
<input type=hidden name="year" value="<?php print $year; ?>">
<input type=hidden name="eventid" value="<?php print $eventid; ?>">
<input type="submit" value="Oppdatere antall løp for alle løpere">
</form>
<?php
}
else {
?>
<form action="<?php print $SCRIPT_NAME; ?>" method="post">
<input type=hidden name="action" value="parse">
<input type=hidden name="year" value="<?php print $year; ?>">
<input type=hidden name="eventid" value="<?php print $eventid; ?>">
<input type=hidden name="requestedclasse" value="<?php print $requestedclasse; ?>">
<input type="submit" value="Fortsett med <?php print $requestedclasse; ?>">
</form>
<?php
}
 
  
  
break;
/////////////////////// UPDATE COUNT //////////////////////////////////
case "updatecount":


  $sqlUpdateCount = "UPDATE fullfort SET COUNT = -(0";
  
  for ($i = 1968; $i <= $year; $i++) {
    $sqlUpdateCount = $sqlUpdateCount . " + (isnull(fullfort." . $i . ")-1)";
  }

  $sqlUpdateCount = $sqlUpdateCount . ")";
  
  print $sqlUpdateCount . "\n\n\n";

  
//$fp = fopen('temp/before'.$year.'-'.$eventid.'-'.date("YmdHis").'.csv', 'w');

    $result=$conn->query($sqlUpdateCount);
 
    if($result === false) {
      trigger_error('Wrong SQL: ' . $sqlUpdateCount  . ' Error: ' . $conn->error, E_USER_ERROR  );
    }
    
    
//$result = mysqli_query($conn, $sqlUpdateCount);
//$row = mysqli_fetch_array($result, MYSQLI_ASSOC);

//foreach ($row as $val) {
//    fputcsv($fp, $val);
//}

//fclose($fp);

?>
<hr> 
  
  
  
<p>Sum oppdatert! 

<?php
print "<p>Tar backup av database...\n\n";

$fp = fopen('temp/after'.$year.'-'.$eventid.'-'.date("YmdHis").'.csv', 'w');

$result = mysqli_query($conn, 'SELECT * FROM fullfort');
$row = mysqli_fetch_array($result, MYSQLI_ASSOC);

foreach ($row as $val) {
    fputcsv($fp, $val);
}

fclose($fp);

?>

<p>Backup OK!

<p>Takk for i år.</p>

<p>Husk å lage zip-fil av filene i temp-katalogen (ta vare på som backup!)

<?php
break;
default:
?>
<form action="<?php echo $SCRIPT_NAME; ?>" method="post">
<input type=hidden name="action" value="backup">
Resultater fra hvilket år skal behandles? <input name="year" maxsize="4">
Hva er Eventor-ID for løpet? <input name="eventid" maxsize="4">
<input type="submit" value="Start">
</form>

<?php
break;
} // end switch




// Closing connection
//mysql_close($link);

?>


</body>
</html>

<?php
function UpperCase($arg)
{
	$a_result = explode(" ",strtolower_utf8($arg));
  
  foreach ($a_result as $i => $a_result_i) {
		if (strlen($a_result_i) < 3) {
      if ($a_result_i == "og") {
        $retval = $retval . " " . strtolower_utf8($a_result_i);
      }
      else {
        $retval = $retval . " " . strtoupper_utf8($a_result_i);
      }
    }
		else {
      if (($a_result_i == "spk") or ($a_result_i == "ntnui") or ($a_result_i == "fso") or ($a_result_i == "ssk") or ($a_result_i == "hfs"))  {
        $retval = $retval . " " . strtoupper_utf8($a_result_i);
      }
      else {
        $retval = $retval . " " . strtoupper_utf8(substr($a_result_i,0,1)) . substr($a_result_i,1);
      }
		}
  }
  return $retval;
}

function strtolower_utf8($string){ 
  $convert_to = array( 
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", 
    "v", "w", "x", "y", "z", "à", "á", "â", "ã", "ä", "å", "æ", "ç", "è", "é", "ê", "ë", "ì", "í", "î", "ï", 
    "ð", "ñ", "ò", "ó", "ô", "õ", "ö", "ø", "ù", "ú", "û", "ü", "ý", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?" 
  ); 
  $convert_from = array( 
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", 
    "V", "W", "X", "Y", "Z", "À", "Á", "Â", "Ã", "Ä", "Å", "Æ", "Ç", "È", "É", "Ê", "Ë", "Ì", "Í", "Î", "Ï", 
    "Ð", "Ñ", "Ò", "Ó", "Ô", "Õ", "Ö", "Ø", "Ù", "Ú", "Û", "Ü", "Ý", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?" 
  ); 

  return str_replace($convert_from, $convert_to, $string); 
} 


function strtoupper_utf8($string){ 
  $convert_from = array( 
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", 
    "v", "w", "x", "y", "z", "à", "á", "â", "ã", "ä", "å", "æ", "ç", "è", "é", "ê", "ë", "ì", "í", "î", "ï", 
    "ð", "ñ", "ò", "ó", "ô", "õ", "ö", "ø", "ù", "ú", "û", "ü", "ý", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?" 
  ); 
  $convert_to = array( 
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", 
    "V", "W", "X", "Y", "Z", "À", "Á", "Â", "Ã", "Ä", "Å", "Æ", "Ç", "È", "É", "Ê", "Ë", "Ì", "Í", "Î", "Ï", 
    "Ð", "Ñ", "Ò", "Ó", "Ô", "Õ", "Ö", "Ø", "Ù", "Ú", "Û", "Ü", "Ý", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", "?", 
    "?", "?", "?", "?" 
  ); 

  return str_replace($convert_from, $convert_to, $string); 
} 

function eventorApiCall($url)
{
  // create curl resource
  $ch = curl_init();
  // set url
  curl_setopt($ch, CURLOPT_URL, $url);
  // return the transfer as a string
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
  curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, FALSE); 

  // set header
  curl_setopt($ch, CURLOPT_HTTPHEADER, array("ApiKey: " . EVENTOR_API_KEY));

  // $output contains the output string
  $output = curl_exec($ch);
  // close curl resource to free up system resources
  if(curl_errno($ch)) 
  { 
   # print "Error: ".curl_errno($ch)."<p>";
  }    
  curl_close($ch);    

  return $output;
}

?>
